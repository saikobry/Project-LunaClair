import { badRequest, json } from '../core/responses';
import { readAiTokenUsage } from '../core/aiUsage';
import {
  resolveAiModelRoute,
  toPublicAiModelCatalog,
  type AiModelRoute,
} from '../core/aiModels';
import type { RouteContext } from '../core/types';
import { resolveAiProvider } from '../ai/providers';
import { toAiProviderError } from '../ai/errors';
import type { AiErrorCode, AiProviderEvent } from '../ai/types';

/**
 * Normalized failure codes the client acts on instead of pattern-matching a message.
 *
 * `RATE_LIMITED` and `CONTEXT_LIMIT` are the two the UI treats specially (retry-with-hint and
 * shorten-or-switch respectively); `UPSTREAM_ERROR` is everything else a provider threw.
 */
type AiResponseCode = AiErrorCode | 'MODEL_UNAVAILABLE' | 'PROVIDER_UNAVAILABLE';

/** HTTP status for each code, so cause and status cannot drift apart at a call site. */
const STATUS_BY_CODE: Record<AiResponseCode, number> = {
  MODEL_UNAVAILABLE: 400,
  CONTEXT_LIMIT: 400,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
  UPSTREAM_ERROR: 502,
};

function failure(
  code: AiResponseCode,
  message: string,
  corsHeaders: Record<string, string>,
  retryAfterSeconds?: number,
): Response {
  return json(
    { error: message, code, ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}) },
    STATUS_BY_CODE[code],
    corsHeaders,
  );
}

/**
 * GET /api/ai/models
 *
 * Serves the public model catalog: the facts the client needs to offer a model choice and to meter
 * a request against the right window. Provider routing data is projected away.
 */
export function handleAiModels(ctx: RouteContext): Response {
  return json(toPublicAiModelCatalog(), 200, ctx.corsHeaders);
}

/**
 * POST /api/ai/chat
 * Streaming chat completions, normalized to app-native SSE events and dispatched to the provider
 * that serves the requested model.
 *
 * The request may name a model (`model`, an app-facing catalog id); an absent id resolves to the
 * catalog default, while an id the registry does not know is refused rather than substituted. The
 * model's own facts drive the request: `maxOutputTokens` is its `max_tokens` and
 * `maxDocumentContextChars` bounds the study material embedded in the prompt.
 *
 * There is deliberately **no fallback model**. The previous silent retry named
 * `@cf/meta/llama-3.1-8b-instruct`, which Cloudflare deprecated on 2026-05-30, so it could fail
 * obscurely after an unrelated primary failure; a failed request now fails visibly with a code.
 */
export async function handleAiChat(ctx: RouteContext): Promise<Response> {
  const { request, env, corsHeaders } = ctx;

  const body = (await request.json().catch(() => null)) as {
    messages?: Array<{ role?: unknown; content?: unknown }>;
    documentContext?: { id?: unknown; title?: unknown; markdown?: unknown };
    selection?: { text?: unknown; surroundingHeading?: unknown; source?: unknown };
    mode?: unknown;
    model?: unknown;
  } | null;

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return badRequest('Invalid request: messages array is required', corsHeaders);
  }

  const requestedModelId =
    typeof body.model === 'string' && body.model.trim() ? body.model.trim() : undefined;
  const modelRoute = resolveAiModelRoute(requestedModelId);

  if (!modelRoute) {
    return failure(
      'MODEL_UNAVAILABLE',
      `Unknown AI model "${requestedModelId}". Call GET /api/ai/models for the available models.`,
      corsHeaders,
    );
  }

  // A missing binding is a deployment gap with a precise diagnosis, so it is named rather than
  // folded into a generic provider failure.
  if (modelRoute.provider === 'workers-ai' && !env.AI) {
    return failure(
      'PROVIDER_UNAVAILABLE',
      'Cloudflare Workers AI binding not configured on Worker',
      corsHeaders,
    );
  }

  const provider = resolveAiProvider(modelRoute, env);
  if (!provider) {
    return failure(
      'PROVIDER_UNAVAILABLE',
      `Model "${modelRoute.id}" is not available on this endpoint.`,
      corsHeaders,
    );
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

  const effectiveSystemPrompt = composeSystemPrompt(
    mode,
    modelRoute,
    docContext,
    selection,
    body.messages,
  );

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
  const encoder = new TextEncoder();

  const sse = (event: Record<string, unknown>): Uint8Array =>
    encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

  const iterator = provider.stream({
    modelId: modelRoute.providerModelId,
    messages: formattedMessages,
    maxOutputTokens: modelRoute.maxOutputTokens,
    temperature: 0.5,
    signal: request.signal,
  })[Symbol.asyncIterator]();

  // Pull one event **before** committing to a 200. Rate limits, context rejections, and binding
  // failures all surface on the first pull, and they must keep their own status and code rather than
  // arriving as a 200 whose body happens to contain an error. Failures after text has started can no
  // longer change the status, so those become an app-native `error` event instead.
  let first: IteratorResult<AiProviderEvent>;
  try {
    first = await iterator.next();
  } catch (err: unknown) {
    const providerError = toAiProviderError(err);
    console.error('AI provider failed before streaming', {
      model: modelRoute.id,
      code: providerError.code,
      message: providerError.message,
    });
    return failure(
      providerError.code,
      providerError.message,
      corsHeaders,
      providerError.retryAfterSeconds,
    );
  }

  const outputStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sse({ type: 'start', messageId }));

      let emittedTokens = 0;
      let usage: ReturnType<typeof readAiTokenUsage>;
      let failedMidStream = false;

      const emit = (event: AiProviderEvent) => {
        if (event.type === 'usage') {
          usage = event.usage;
          return;
        }
        emittedTokens += 1;
        controller.enqueue(sse({ type: 'token', text: event.text }));
      };

      try {
        if (!first.done) emit(first.value);
        for (;;) {
          const next = await iterator.next();
          if (next.done) break;
          emit(next.value);
        }
      } catch (err: unknown) {
        const providerError = toAiProviderError(err);
        failedMidStream = true;
        console.error('AI provider stream failed mid-stream', {
          model: modelRoute.id,
          code: providerError.code,
          message: providerError.message,
        });
        controller.enqueue(
          sse({
            type: 'error',
            code: providerError.code,
            message: providerError.message,
            ...(providerError.retryAfterSeconds !== undefined
              ? { retryAfterSeconds: providerError.retryAfterSeconds }
              : {}),
          }),
        );
      }

      // A 200 that carries no text is otherwise indistinguishable from a hang on the client, which
      // sees only a start and a done. Log it server-side so the cause is visible in `wrangler tail`.
      if (emittedTokens === 0 && !failedMidStream) {
        console.warn('AI stream completed without producing any tokens', {
          model: modelRoute.id,
          provider: provider.id,
        });
      }

      // `usage` is omitted by JSON.stringify when the provider reported none, which is the same
      // thing as "unknown" — never a fabricated zero. It is sent even after a mid-stream failure:
      // a turn that erred after consuming tokens is still attributed to the model that served it.
      controller.enqueue(sse({ type: 'done', usage, model: modelRoute.id }));
      controller.close();
    },
  });

  return new Response(outputStream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'connection': 'keep-alive',
      ...corsHeaders,
    },
  });
}

/**
 * Composes the server-side system prompt: mode framing, study material (bounded by the served
 * model's own document cap), selection, then any client-supplied task instructions.
 *
 * Kept server-side so prompt composition stays provider-neutral and the per-model character budget
 * is applied by the party that knows the model.
 */
function composeSystemPrompt(
  mode: string,
  modelRoute: AiModelRoute,
  docContext: { title: string; markdown: string } | undefined,
  selection: { text: string; surroundingHeading?: string } | undefined,
  clientMessages: Array<{ role?: unknown; content?: unknown }>,
): string {
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
    systemPrompt += `\n\n--- STUDY MATERIAL: ${docContext.title || 'Current Document'} ---\n${docContext.markdown.slice(0, modelRoute.maxDocumentContextChars)}\n--- END OF STUDY MATERIAL ---`;
    systemPrompt +=
      '\n\nGround your answers in the provided study material whenever relevant. If the material does not contain the answer, use your general knowledge but clearly indicate that it is beyond the material.';
  }

  if (selection?.text) {
    systemPrompt += `\n\n--- SELECTED TEXT ---\n"${selection.text}"\n--- END OF SELECTED TEXT ---`;
    if (selection.surroundingHeading) {
      systemPrompt += ` (From section: ${selection.surroundingHeading})`;
    }
  }

  const clientSystemMsgs = clientMessages
    .flatMap((m) =>
      m.role === 'system' && typeof m.content === 'string' && m.content.trim()
        ? [m.content.trim()]
        : [],
    )
    .join('\n\n');

  return clientSystemMsgs
    ? `${systemPrompt}\n\n--- TASK SPECIFIC INSTRUCTIONS ---\n${clientSystemMsgs}`
    : systemPrompt;
}
