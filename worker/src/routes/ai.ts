import { badRequest, json } from '../core/responses';
import { readAiTokenUsage } from '../core/aiUsage';
import {
  isAiChatDisabled,
  isAiModelServed,
  resolveAiModelRoute,
  resolveDisabledAiModelIds,
  toPublicAiModelCatalog,
  type AiModelRoute,
} from '../core/aiModels';
import type { RouteContext } from '../core/types';
import { resolveAiProvider } from '../ai/providers';
import { toAiProviderError } from '../ai/errors';
import {
  logAiRequestTelemetry,
  safeTelemetryMessage,
  type AiRequestReason,
  type AiRequestTelemetry,
} from '../ai/telemetry';
import {
  AI_FIRST_EVENT_TIMEOUT_MS,
  AI_STREAM_IDLE_TIMEOUT_MS,
  withIdleDeadline,
} from '../ai/deadline';
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
  AI_DISABLED: 503,
  MODEL_UNAVAILABLE: 400,
  CONTEXT_LIMIT: 400,
  RATE_LIMITED: 429,
  TIMEOUT: 504,
  ABORTED: 499,
  PROVIDER_UNAVAILABLE: 503,
  UPSTREAM_ERROR: 502,
};

/**
 * The client went away mid-request (it pressed Stop, or navigated off).
 *
 * Nothing reads this body, so it exists to keep the failure out of the error path: reporting a
 * cancellation as a 502 would make a user-initiated Stop look like a broken endpoint.
 */
function aborted(corsHeaders: Record<string, string>): Response {
  return new Response(null, { status: STATUS_BY_CODE.ABORTED, headers: corsHeaders });
}

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
  // 200 even when disabled: the client must be able to tell "the assistant is intentionally off"
  // from "we cannot reach the endpoint", and an error status would look identical to the latter.
  return json(
    toPublicAiModelCatalog(resolveDisabledAiModelIds(ctx.env), isAiChatDisabled(ctx.env)),
    200,
    ctx.corsHeaders,
  );
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
 *
 * Every provider pull is bounded by an idle deadline, so a provider that goes silent mid-answer
 * fails as `TIMEOUT` rather than holding the response open; a client that cancels is answered with
 * `ABORTED` instead of being dressed up as an upstream failure.
 */
export async function handleAiChat(ctx: RouteContext): Promise<Response> {
  const { request, env, corsHeaders } = ctx;
  const requestStartedAt = Date.now();

  /**
   * Emits this request's one telemetry record, whichever way it ends.
   *
   * Guarded rather than repeated at each exit: a request has exactly one outcome, and a path that
   * both failed and then unwound would otherwise report twice. See `ai/telemetry.ts` for what the
   * record may contain — never prompt, document, or selection text.
   */
  let telemetryLogged = false;
  const recordRequest = (
    outcome: AiRequestTelemetry['outcome'],
    fields: Omit<AiRequestTelemetry, 'outcome' | 'durationMs'> & { reason?: AiRequestReason },
  ): void => {
    if (telemetryLogged) return;
    telemetryLogged = true;
    logAiRequestTelemetry({ outcome, durationMs: Date.now() - requestStartedAt, ...fields });
  };

  // A disconnected client leaves nobody to answer; short-circuit before parsing or spending work.
  if (request.signal.aborted) {
    recordRequest('aborted', {
      status: 499,
      model: null,
      provider: null,
      stage: 'pre-stream',
      reason: 'client-abort',
      emittedTokenChunks: 0,
    });
    return aborted(corsHeaders);
  }

  // The global shutdown is checked before the body is even read, so it consistently beats an invalid
  // requested model, a malformed body, or a missing binding: when the assistant is off, that is the
  // only thing worth telling a caller.
  if (isAiChatDisabled(env)) {
    recordRequest('rejected', {
      status: 503,
      model: null,
      provider: null,
      code: 'AI_DISABLED',
      stage: 'pre-stream',
      reason: 'global-shutdown',
      emittedTokenChunks: 0,
    });
    return failure(
      'AI_DISABLED',
      'The AI assistant is temporarily unavailable.',
      corsHeaders,
    );
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: Array<{ role?: unknown; content?: unknown }>;
    documentContext?: { id?: unknown; title?: unknown; markdown?: unknown };
    selection?: { text?: unknown; surroundingHeading?: unknown; source?: unknown };
    mode?: unknown;
    model?: unknown;
  } | null;

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    recordRequest('rejected', {
      status: 400,
      model: null,
      provider: null,
      code: 'BAD_REQUEST',
      stage: 'pre-stream',
      emittedTokenChunks: 0,
    });
    return badRequest('Invalid request: messages array is required', corsHeaders);
  }

  const requestedModelId =
    typeof body.model === 'string' && body.model.trim() ? body.model.trim() : undefined;
  const modelRoute = resolveAiModelRoute(requestedModelId);

  if (!modelRoute) {
    recordRequest('rejected', {
      status: 400,
      model: null,
      provider: null,
      code: 'MODEL_UNAVAILABLE',
      stage: 'pre-stream',
      reason: 'model-unknown',
      emittedTokenChunks: 0,
    });
    return failure(
      'MODEL_UNAVAILABLE',
      `Unknown AI model "${requestedModelId}". Call GET /api/ai/models for the available models.`,
      corsHeaders,
    );
  }

  // A disabled model is a distinct case from an unknown one: the id is real, so the client should
  // refresh its catalog and pick again rather than treat the request as a bug. This now applies to
  // **every** model including the default, because "stop this model" has to be able to stop the one
  // every degraded selection path falls back to.
  const disabledModelIds = resolveDisabledAiModelIds(env);
  if (!isAiModelServed(modelRoute, disabledModelIds, false)) {
    recordRequest('rejected', {
      status: 400,
      model: modelRoute.id,
      provider: modelRoute.provider,
      code: 'MODEL_UNAVAILABLE',
      stage: 'pre-stream',
      reason: 'model-disabled',
      emittedTokenChunks: 0,
    });
    return failure(
      'MODEL_UNAVAILABLE',
      `Model "${modelRoute.id}" is not currently available on this endpoint.`,
      corsHeaders,
    );
  }

  // A missing binding is a deployment gap with a precise diagnosis, so it is named rather than
  // folded into a generic provider failure.
  if (modelRoute.provider === 'workers-ai' && !env.AI) {
    recordRequest('rejected', {
      status: 503,
      model: modelRoute.id,
      provider: modelRoute.provider,
      code: 'PROVIDER_UNAVAILABLE',
      stage: 'pre-stream',
      reason: 'provider-unconfigured',
      emittedTokenChunks: 0,
    });
    return failure(
      'PROVIDER_UNAVAILABLE',
      'Cloudflare Workers AI binding not configured on Worker',
      corsHeaders,
    );
  }

  const provider = resolveAiProvider(modelRoute, env);
  if (!provider) {
    recordRequest('rejected', {
      status: 503,
      model: modelRoute.id,
      provider: modelRoute.provider,
      code: 'PROVIDER_UNAVAILABLE',
      stage: 'pre-stream',
      reason: 'provider-unconfigured',
      emittedTokenChunks: 0,
    });
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

  // Set when the consumer goes away — an aborted request or a cancelled response body. Nothing is
  // written after this: an `enqueue` on a cancelled stream throws, and an unguarded throw in the
  // error path would skip the terminal `done` and leave the stream errored instead of closed.
  //
  // Declared before the abort listener below on purpose: a disconnected client must stop the writes
  // even if the runtime never calls the stream's `cancel()` callback, which is not guaranteed.
  let consumerCancelled = false;
  // First-write-wins: if the client aborted, later stream cancel callbacks do not overwrite it.
  let cancelReason: AiRequestReason = 'consumer-cancel';

  const markCancelled = (reason: AiRequestReason) => {
    if (!consumerCancelled) cancelReason = reason;
    consumerCancelled = true;
  };

  let released = false;
  let iterator: AsyncIterator<AiProviderEvent> | undefined;

  // One controller per provider stream, owned by the route. This is what turns "the promise we were
  // awaiting is abandoned" into "the outbound work is over": a deadline or a vanished client aborts
  // it, and every provider receives it as `signal` (see `AiProviderRequest`).
  const providerController = new AbortController();
  const abortProvider = () => providerController.abort();

  /**
   * Runs the provider generator's own cleanup and stops the outbound work.
   *
   * `iterator.return()` is what unwinds a generator suspended at a `yield` — its `finally` releases
   * the SSE reader — and it is deliberately **not awaited**: a provider that ignores the signal (an
   * in-process binding that cannot be cancelled) must not be able to hold the response open either.
   * Idempotent, because several paths (a deadline, a cancel, and the exit) can all reach it.
   */
  const releaseProvider = () => {
    if (released) return;
    released = true;
    request.signal.removeEventListener('abort', forwardRequestAbort);
    abortProvider();
    if (iterator?.return) {
      try {
        const returned = iterator.return();
        if (returned) void Promise.resolve(returned).catch(() => undefined);
      } catch {
        // Synchronous throw ignored
      }
    }
  };

  const forwardRequestAbort = () => {
    markCancelled('client-abort');
    releaseProvider();
  };
  request.signal.addEventListener('abort', forwardRequestAbort, { once: true });

  const streamIterator = provider.stream({
    modelId: modelRoute.providerModelId,
    messages: formattedMessages,
    maxOutputTokens: modelRoute.maxOutputTokens,
    temperature: 0.5,
    signal: providerController.signal,
    connectTimeoutMs: AI_FIRST_EVENT_TIMEOUT_MS,
  })[Symbol.asyncIterator]();

  iterator = streamIterator;
  if (released) {
    try {
      const returned = iterator.return?.();
      if (returned) void Promise.resolve(returned).catch(() => undefined);
    } catch {
      // Synchronous throw ignored
    }
  }

  // Pull one event **before** committing to a 200. Rate limits, context rejections, and binding
  // failures all surface on the first pull, and they must keep their own status and code rather than
  // arriving as a 200 whose body happens to contain an error. Failures after text has started can no
  // longer change the status, so those become an app-native `error` event instead.
  let first: IteratorResult<AiProviderEvent>;
  let firstEventMs: number | undefined;
  try {
    // The **first-event** deadline, shorter than the client's own watchdog: the Worker should be the
    // one to report a stalled provider, because its failure is coded and specific.
    first = await withIdleDeadline(
      iterator.next(),
      AI_FIRST_EVENT_TIMEOUT_MS,
      releaseProvider,
    );
    firstEventMs = Date.now() - requestStartedAt;
  } catch (err: unknown) {
    if (request.signal.aborted) {
      // The client itself went away: a cancellation, not an upstream fault, which is why it is not
      // recorded as an error and carries no code.
      recordRequest('aborted', {
        status: 499,
        model: modelRoute.id,
        provider: provider.id,
        stage: 'pre-stream',
        reason: 'client-abort',
        emittedTokenChunks: 0,
      });
      releaseProvider();
      return aborted(corsHeaders);
    }
    const providerError = toAiProviderError(err);
    const failureStatus = STATUS_BY_CODE[providerError.code as AiResponseCode] ?? 500;
    recordRequest('error', {
      status: failureStatus,
      model: modelRoute.id,
      provider: provider.id,
      code: providerError.code,
      stage: 'pre-stream',
      ...(providerError.code === 'TIMEOUT' ? { reason: 'timeout' as const } : {}),
      message: safeTelemetryMessage(providerError.code, providerError.message),
      ...(providerError.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: providerError.retryAfterSeconds }
        : {}),
      emittedTokenChunks: 0,
    });
    releaseProvider();
    return failure(
      providerError.code,
      providerError.message,
      corsHeaders,
      providerError.retryAfterSeconds,
    );
  }

  const outputStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueueIfActive = (chunk: Uint8Array): boolean => {
        if (consumerCancelled) return false;
        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          // The consumer vanished between the check and the write.
          markCancelled('consumer-cancel');
          releaseProvider();
          return false;
        }
      };

      enqueueIfActive(sse({ type: 'start', messageId }));

      let emittedTokenChunks = 0;
      let usage: ReturnType<typeof readAiTokenUsage>;
      // Non-undefined only when the provider failed after text had started; it is also the flag that
      // distinguishes a failure from a clean finish below.
      let streamFailure: ReturnType<typeof toAiProviderError> | undefined;

      const emit = (event: AiProviderEvent): boolean => {
        if (event.type === 'usage') {
          usage = event.usage;
          return true;
        }
        emittedTokenChunks += 1;
        return enqueueIfActive(sse({ type: 'token', text: event.text }));
      };

      const pullNext = (timeoutMs: number) =>
        withIdleDeadline(iterator!.next(), timeoutMs, releaseProvider);

      try {
        if (!first.done && !consumerCancelled) {
          if (!emit(first.value)) {
            // Write failed; consumer disconnected
          }
        }
        while (!consumerCancelled) {
          // Idle, not total: a long answer that keeps producing tokens may stream indefinitely,
          // while one that stops producing fails within the deadline instead of hanging the drawer.
          const next = await pullNext(AI_STREAM_IDLE_TIMEOUT_MS);
          if (next.done || consumerCancelled) break;
          if (!emit(next.value)) break;
        }
      } catch (err: unknown) {
        if (!consumerCancelled) {
          const providerError = toAiProviderError(err);
          streamFailure = providerError;
          enqueueIfActive(
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
      } finally {
        // A 200 that carries no text is otherwise indistinguishable from a hang on the client, which
        // sees only a start and a done. The telemetry record below carries `emittedTokenChunks: 0` for this
        // case, which is what makes it countable instead of a single line nobody correlates.

        // `usage` is omitted by JSON.stringify when the provider reported none, which is the same
        // thing as "unknown" — never a fabricated zero. It is sent even after a mid-stream failure:
        // a turn that erred after consuming tokens is still attributed to the model that served it.
        if (!consumerCancelled) {
          enqueueIfActive(sse({ type: 'done', usage, model: modelRoute.id }));
          try {
            controller.close();
          } catch {
            // Already closed or errored; nothing left to report.
          }
        }

        // The one record for this request, however it ended. A cancellation is reported as such rather
        // than as the failure the provider threw on its way out.
        if (consumerCancelled) {
          recordRequest('aborted', {
            status: 200,
            model: modelRoute.id,
            provider: provider.id,
            stage: 'mid-stream',
            reason: cancelReason,
            firstEventMs,
            emittedTokenChunks,
          });
        } else if (streamFailure) {
          recordRequest('error', {
            status: 200,
            model: modelRoute.id,
            provider: provider.id,
            code: streamFailure.code,
            stage: 'mid-stream',
            ...(streamFailure.code === 'TIMEOUT' ? { reason: 'timeout' as const } : {}),
            message: safeTelemetryMessage(streamFailure.code, streamFailure.message),
            ...(streamFailure.retryAfterSeconds !== undefined
              ? { retryAfterSeconds: streamFailure.retryAfterSeconds }
              : {}),
            firstEventMs,
            emittedTokenChunks,
            ...(usage ? { usage } : {}),
          });
        } else {
          recordRequest('ok', {
            status: 200,
            model: modelRoute.id,
            provider: provider.id,
            stage: 'mid-stream',
            firstEventMs,
            emittedTokenChunks,
            ...(usage ? { usage } : {}),
          });
        }

        releaseProvider();
      }
    },

    /** The consumer went away mid-stream: stop spending the provider's capacity on nobody. */
    cancel() {
      markCancelled('consumer-cancel');
      releaseProvider();
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
