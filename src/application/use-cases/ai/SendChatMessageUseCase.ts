import type { AiService } from '../../../domain/ai/services/AiService';
import type { AiChatRepository } from '../../../domain/ai/repositories/AiChatRepository';
import type {
  AiChatMessage,
  AiDocumentContext,
  AiGroundingMode,
  AiMessageRecord,
  AiStreamEvent,
  AiTutorMode,
  AiUsage,
} from '../../../domain/ai/models/ai.types';
import { AiContextBuilder } from '../../../domain/ai/context/AiContextBuilder';
import {
  AiGroundingResolver,
  AiGroundingUnavailableError,
  AiThreadUnavailableError,
} from './AiGroundingResolver';

export interface SendChatMessageInput {
  /** Optional ID of the thread to auto-persist user and assistant message turns. */
  threadId?: string;
  messages: AiChatMessage[];
  /**
   * The study material is deliberately **not** a send-time option. A conversation records whether it
   * is grounded (`AiThread.grounding`) and `AiGroundingResolver` reads the document from that record,
   * so a retry cannot re-send a prompt with the material missing — the defect this replaced.
   */
  selection?: {
    text: string;
    surroundingHeading?: string;
    source?: string;
  };
  mode?: AiTutorMode;
  /** App-facing model id; omitted = the Worker's catalog default. */
  model?: string;
  signal?: AbortSignal;
}

async function* createValidationError(message: string): AsyncIterable<AiStreamEvent> {
  yield {
    type: 'error',
    code: 'VALIDATION_ERROR',
    message,
  };
}

/**
 * Application use case for sending chat messages and receiving a token stream.
 *
 * Coordinates context construction via AiContextBuilder, coordinates local turn persistence
 * via AiChatRepository (without holding open long-lived transactions across network streams),
 * and delegates to AiService for model inference.
 *
 * Grounding is resolved here rather than passed in, and the turn is opened as an atomic pair, so
 * both the retry case and the cancellation case are correct by construction rather than by a caller
 * remembering to pass the right argument.
 */
export class SendChatMessageUseCase {
  private readonly aiService: AiService;
  private readonly chatRepo?: AiChatRepository;
  /** Required, not optional: a conversation-bearing send must never proceed ungrounded because
   *  composition forgot to supply the resolver. */
  private readonly groundingResolver: AiGroundingResolver;

  constructor(
    aiService: AiService,
    groundingResolver: AiGroundingResolver,
    chatRepo?: AiChatRepository,
  ) {
    this.aiService = aiService;
    this.groundingResolver = groundingResolver;
    this.chatRepo = chatRepo;
  }

  async *execute(input: SendChatMessageInput): AsyncIterable<AiStreamEvent> {
    if (!input.messages || input.messages.length === 0) {
      yield* createValidationError('At least one message is required to send a chat request.');
      return;
    }

    const selection = AiContextBuilder.buildSelectionContext(input.selection);
    const mode: AiTutorMode = input.mode ?? 'assistant';
    const threadId = input.threadId;

    const lastMessage = input.messages[input.messages.length - 1];
    const userRecord: AiMessageRecord | undefined =
      threadId && lastMessage && lastMessage.role === 'user'
        ? {
            id: lastMessage.id,
            threadId,
            role: 'user',
            content: lastMessage.content,
            status: 'complete',
            createdAt: lastMessage.createdAt,
          }
        : undefined;

    // 1. Resolve grounding once, for the whole turn, from the conversation's own record. No caller
    //    supplies the material, so none can forget it — the reason a retry used to lose the document.
    let documentContext: AiDocumentContext | undefined;
    // The resolved mode is a per-turn *request fact* snapshotted onto the turn records below. Kept
    // outside the `try` so a successful resolution survives to the write path; a failure throws before
    // assignment, leaving it `undefined`, so a failed turn carries no grounding claim rather than a
    // guessed one.
    let resolvedGrounding: AiGroundingMode | undefined;
    if (threadId) {
      try {
        const snapshot = await this.groundingResolver.resolve(
          { threadId },
          { model: input.model, signal: input.signal },
        );
        documentContext = snapshot.documentContext;
        resolvedGrounding = snapshot.mode;
      } catch (err: unknown) {
        // An abort is the user ending the request, not a failure: write nothing, exactly like an
        // interrupted turn, which is left to the recovery path.
        if (input.signal?.aborted) return;

        const message = err instanceof Error ? err.message : 'Grounding could not be resolved.';

        // A missing conversation is not persisted against: there is no parent for the pair, and the
        // adapter would reject the write anyway.
        if (err instanceof AiThreadUnavailableError) {
          yield { type: 'error', code: err.code, message };
          return;
        }

        const code = err instanceof AiGroundingUnavailableError ? err.code : 'GROUNDING_UNAVAILABLE';
        if (userRecord) {
          await this.persistFailedTurn(threadId, userRecord, { code, message });
        }
        yield { type: 'error', code, message };
        return;
      }
    }

    // The user turn is stamped now that grounding has settled. `'none'` is written when the mode was
    // resolved and off; `undefined` is reserved for "never resolved" (a failed turn, or a pre-field
    // row). This is deliberately `!== undefined`, not a truthiness check — do not simplify it to omit
    // `'none'`, which would erase the distinction between a checked-off turn and a legacy one.
    if (userRecord && resolvedGrounding !== undefined) {
      userRecord.metadata = { grounding: resolvedGrounding };
    }

    // 2. Open the turn atomically: the user record and its assistant placeholder land in one
    //    transaction, so no cancellation can strand a user turn without a partner. The placeholder is
    //    what the pre-existing `recoverInterruptedMessages` repairs on reopen — this is why
    //    `status: 'streaming'` exists.
    let assistantId: string | null = null;
    if (this.chatRepo && threadId && userRecord) {
      assistantId = `assistant-${crypto.randomUUID()}`;
      const userTime = new Date(userRecord.createdAt).getTime();
      const placeholderTime = Math.max(Date.now(), userTime + 1);
      const placeholder: AiMessageRecord = {
        id: assistantId,
        threadId,
        role: 'assistant',
        content: '',
        status: 'streaming',
        createdAt: new Date(placeholderTime).toISOString(),
        // Carried onto the placeholder so an interrupted turn (recovered, never settled) still
        // remembers the request fact; the settle path overwrites it with the same value.
        ...(resolvedGrounding !== undefined
          ? { metadata: { grounding: resolvedGrounding } }
          : {}),
      };
      try {
        await this.chatRepo.saveMessagePair(userRecord, placeholder);
      } catch {
        // The transaction rolled back, so nothing was persisted — there is no orphan to repair. The
        // hook keeps the prompt retryable from feature state, and this coded failure is what the user
        // sees, rather than an answer that would vanish on the next refetch.
        yield {
          type: 'error',
          code: 'PERSISTENCE_ERROR',
          message: 'The conversation could not be saved. Please try again.',
        };
        return;
      }
    }

    // 3. Start streaming inference (outside of any database transaction)
    let accumulatedText = '';
    let finalUsage: AiUsage | undefined;
    let finalModel: string | undefined;
    let streamError: { code: string; message: string } | null = null;

    try {
      const stream = this.aiService.streamChat({
        messages: input.messages,
        documentContext,
        selection,
        mode,
        model: input.model,
        signal: input.signal,
      });

      for await (const event of stream) {
        if (input.signal?.aborted) break;

        switch (event.type) {
          case 'start':
            break;
          case 'token':
            accumulatedText += event.text;
            break;
          case 'done':
            finalUsage = event.usage;
            finalModel = event.model;
            break;
          case 'error':
            streamError = { code: event.code, message: event.message };
            break;
        }

        yield event;
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown streaming error';
      streamError = { code: 'STREAM_ERROR', message: errorMessage };
      yield { type: 'error', code: 'STREAM_ERROR', message: errorMessage };
    } finally {
      // 4. Settle the assistant turn opened in step 2. Skipped when aborted on purpose: the
      //    placeholder is left 'streaming' so `recoverInterruptedMessages` converts it to INTERRUPTED.
      if (this.chatRepo && threadId && assistantId && !input.signal?.aborted) {
        const chatRepo = this.chatRepo;
        const id = assistantId;
        const now = new Date().toISOString();

        // Token accounting rides whichever outcome is persisted. A turn that errored mid-stream still
        // consumed the tokens it received, so dropping usage on failure would under-report it.
        const telemetry: NonNullable<AiMessageRecord['metadata']> = {
          ...(finalUsage ? { usage: finalUsage } : {}),
          ...(finalModel ? { model: finalModel } : {}),
          // A stream error after successful grounding still records that the material was attached —
          // the request fact is about what was sent, not about how the turn ended.
          ...(resolvedGrounding !== undefined ? { grounding: resolvedGrounding } : {}),
        };

        const settle = async (
          status: 'complete' | 'error',
          content: string,
          metadata: NonNullable<AiMessageRecord['metadata']>,
        ): Promise<void> => {
          try {
            await chatRepo.saveMessage({
              id,
              threadId,
              role: 'assistant',
              content,
              status,
              createdAt: now,
              metadata,
            });
          } catch {
            // The placeholder stays 'streaming' and the recovery path repairs it on reopen.
          }
        };

        if (streamError) {
          await settle('error', accumulatedText, {
            errorCode: streamError.code,
            errorMessage: streamError.message,
            ...telemetry,
          });
        } else if (accumulatedText) {
          await settle('complete', accumulatedText, telemetry);
        } else {
          // An empty completion is settled as an empty error turn, never left pending: the user turn
          // must not be stranded without a partner, and an empty error turn is excluded from the next
          // request along with its user turn (`projectRequestMessages`).
          await settle('error', '', {
            errorCode: 'EMPTY_RESPONSE',
            errorMessage: 'The assistant returned an empty response.',
            ...telemetry,
          });

          // Reported once, from the one place that knows the turn produced nothing. The feature hook
          // no longer has to synthesise this failure from an absence of events, so the banner and the
          // persisted error turn cannot disagree — and an error turn is persisted, the inline card is
          // what the user acts on.
          yield {
            type: 'error',
            code: 'EMPTY_RESPONSE',
            message: 'The assistant returned an empty response. Please try again.',
          };
        }
      }
    }
  }

  /**
   * Writes a failed exchange as an atomic pair, so a grounding failure still leaves one visible,
   * retryable record instead of a user turn with nothing after it.
   */
  private async persistFailedTurn(
    threadId: string,
    userRecord: AiMessageRecord,
    error: { code: string; message: string },
  ): Promise<void> {
    if (!this.chatRepo) return;

    const userTime = new Date(userRecord.createdAt).getTime();
    const assistantTime = Math.max(Date.now(), userTime + 1);
    const assistantRecord: AiMessageRecord = {
      id: `assistant-${crypto.randomUUID()}`,
      threadId,
      role: 'assistant',
      content: '',
      status: 'error',
      createdAt: new Date(assistantTime).toISOString(),
      metadata: { errorCode: error.code, errorMessage: error.message },
    };

    try {
      await this.chatRepo.saveMessagePair(userRecord, assistantRecord);
    } catch {
      // Nothing persisted; the coded error is still what the user sees, and the prompt stays
      // retryable from feature state.
    }
  }
}
