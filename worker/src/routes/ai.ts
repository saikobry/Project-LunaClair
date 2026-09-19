import { badRequest, json } from '../core/responses';
import { readAiTokenUsage, type AiTokenUsage } from '../core/aiUsage';
import type { RouteContext } from '../core/types';

const PRIMARY_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const FALLBACK_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';

/**
 * Output budget per request; mirrored by the client's `AI_RESERVED_OUTPUT_TOKENS`.
 *
 * Cloudflare validates a request against the **estimated input plus this reservation** — not the
 * input alone, and not the tokens actually generated. Its rejection names both numbers, e.g.
 * "5021: The estimated number of input and maximum output tokens (8810) exceeded this model context
 * window limit (8192)", which is why the client's prompt budget subtracts this value from the window.
 */
const MAX_OUTPUT_TOKENS = 4_096;

/**
 * POST /api/ai/chat
 * Streaming chat completions using Cloudflare Workers AI with fallback and SSE formatting.
 */
export async function handleAiChat(ctx: RouteContext): Promise<Response> {
  const { request, env, corsHeaders } = ctx;

  if (!env.AI) {
    return json({ error: 'Cloudflare Workers AI binding not configured on Worker' }, 503, corsHeaders);
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: Array<{ role?: unknown; content?: unknown }>;
    documentContext?: { id?: unknown; title?: unknown; markdown?: unknown };
    selection?: { text?: unknown; surroundingHeading?: unknown; source?: unknown };
    mode?: unknown;
  } | null;

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return badRequest('Invalid request: messages array is required', corsHeaders);
  }

  const mode = typeof body.mode === 'string' ? body.mode : 'assistant';
  const docContext =
    body.documentContext && typeof body.documentContext.markdown === 'string'
      ? {
          title: typeof body.documentContext.title === 'string' ? body.documentContext.title : '',
          markdown: body.documentContext.markdown,
        }
      : undefined;
  const selection =
    body.selection && typeof body.selection.text === 'string'
      ? {
          text: body.selection.text,
          surroundingHeading:
            typeof body.selection.surroundingHeading === 'string'
              ? body.selection.surroundingHeading
              : undefined,
        }
      : undefined;

  let systemPrompt =
    'You are an intelligent study assistant for Project LunaClair, an interactive learning platform. ';
  switch (mode) {
    case 'socratic':
      systemPrompt +=
        'You are in SOCRATIC TUTOR mode. Do not give the direct answer away immediately. Ask guiding questions, break complex problems into steps, and encourage the student to think critically.';
      break;
    case 'explain':
      systemPrompt +=
        'You are in EXPLAIN mode. Provide a clear, structured, and thorough explanation of the concept or selected text.';
      break;
    case 'simplify':
      systemPrompt +=
        'You are in SIMPLIFY mode. Explain the concept in simple, accessible terms using an intuitive real-world analogy suitable for a beginner.';
      break;
    case 'example':
      systemPrompt +=
        'You are in EXAMPLE mode. Provide concrete, illustrative, and memorable examples demonstrating the concept in action.';
      break;
    case 'assistant':
    default:
      systemPrompt +=
        'You are in STUDY ASSISTANT mode. Answer the student\'s questions accurately, concisely, and helpfully.';
      break;
  }

  if (docContext?.markdown) {
    systemPrompt += `\n\n--- STUDY MATERIAL: ${docContext.title || 'Current Document'} ---\n${docContext.markdown.slice(0, 16000)}\n--- END OF STUDY MATERIAL ---`;
    systemPrompt +=
      '\n\nGround your answers in the provided study material whenever relevant. If the material does not contain the answer, use your general knowledge but clearly indicate that it is beyond the material.';
  }

  if (selection?.text) {
    systemPrompt += `\n\n--- SELECTED TEXT ---\n"${selection.text}"\n--- END OF SELECTED TEXT ---`;
    if (selection.surroundingHeading) {
      systemPrompt += ` (From section: ${selection.surroundingHeading})`;
    }
  }

  const clientSystemMsgs = body.messages
    .flatMap((m) =>
      m.role === 'system' && typeof m.content === 'string' && m.content.trim()
        ? [m.content.trim()]
        : [],
    )
    .join('\n\n');

  const effectiveSystemPrompt = clientSystemMsgs
    ? `${systemPrompt}\n\n--- TASK SPECIFIC INSTRUCTIONS ---\n${clientSystemMsgs}`
    : systemPrompt;

  const formattedMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: effectiveSystemPrompt },
  ];

  for (const m of body.messages) {
    if (m && typeof m.content === 'string' && m.role !== 'system') {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      const lastMsg = formattedMessages[formattedMessages.length - 1];
      if (lastMsg && lastMsg.role === role) {
        lastMsg.content += `\n\n${m.content}`;
      } else {
        formattedMessages.push({ role, content: m.content });
      }
    }
  }

  const messageId = `msg-${crypto.randomUUID()}`;

  // Which model actually served the stream, plus the provider's token accounting for it. Both ride
  // the terminal `done` event so the client can attribute a turn's real cost: the two models bill at
  // different rates, so a cost without the serving model is a guess rather than a measurement.
  let modelUsed = PRIMARY_AI_MODEL;
  let finalUsage: AiTokenUsage | undefined;
  let emittedTokenCount = 0;
  /** First payload that carried neither text nor usage — the only clue if nothing is generated. */
  let unexpectedPayloadSample: string | undefined;

  try {
    let aiResponse: unknown;
    try {
      aiResponse = await env.AI.run(PRIMARY_AI_MODEL, {
        messages: formattedMessages,
        stream: true,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.5,
      });
    } catch (primaryErr) {
      console.warn('Primary AI model encountered error, falling back to Llama 3.1 8B:', primaryErr);
      modelUsed = FALLBACK_AI_MODEL;
      aiResponse = await env.AI.run(FALLBACK_AI_MODEL, {
        messages: formattedMessages,
        stream: true,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.5,
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let buffer = '';

    /**
     * Emits one Workers AI SSE line as app-native events. Shared by `transform` and `flush` so the
     * trailing buffered line is handled by exactly the same rules as every complete line before it.
     */
    const handleLine = (line: string, controller: TransformStreamDefaultController<Uint8Array>) => {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) return;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') return;

      let parsed: { response?: unknown; usage?: unknown };
      try {
        parsed = JSON.parse(payload) as { response?: unknown; usage?: unknown };
      } catch {
        return; // Incomplete line or malformed payload
      }

      // Cloudflare attaches token usage to the terminal chunk; a later report supersedes an earlier one.
      const usage = readAiTokenUsage(parsed.usage);
      if (usage) finalUsage = usage;

      const hasText = typeof parsed.response === 'string' && parsed.response.length > 0;

      // A payload with neither text nor usage is a shape this endpoint does not understand — most
      // likely a provider error object, which would otherwise be discarded without trace.
      if (!hasText && !usage && unexpectedPayloadSample === undefined) {
        unexpectedPayloadSample = payload.slice(0, 300);
      }

      if (hasText) {
        emittedTokenCount += 1;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'token', text: parsed.response })}\n\n`),
        );
      }
    };

    const transformStream = new TransformStream<Uint8Array, Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', messageId })}\n\n`));
      },
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) handleLine(line, controller);
      },
      flush(controller) {
        handleLine(buffer, controller);
        // A 200 that carries no text is otherwise indistinguishable from a hang on the client, which
        // sees only a start and a done. Log it server-side so the cause is visible in `wrangler tail`.
        if (emittedTokenCount === 0) {
          console.warn('Workers AI stream completed without producing any tokens', {
            model: modelUsed,
            sample: unexpectedPayloadSample,
          });
        }
        // `usage` is omitted by JSON.stringify when the provider reported none, which is the same
        // thing as "unknown" — never a fabricated zero.
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', usage: finalUsage, model: modelUsed })}\n\n`,
          ),
        );
      },
    });

    const outputStream = (aiResponse as ReadableStream<Uint8Array>).pipeThrough(transformStream);

    return new Response(outputStream, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        'connection': 'keep-alive',
        ...corsHeaders,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'AI stream invocation failed';
    return json({ error: errorMsg }, 500, corsHeaders);
  }
}
