import type { AiService } from '../../../domain/ai/AiService';
import type { AiChatRepository } from '../../../domain/ai/AiChatRepository';
import type {
  AiChatMessage,
  AiMessageRecord,
  AiStreamEvent,
  AiTutorMode,
  AiUsage,
} from '../../../domain/ai/ai.types';
import { AiContextBuilder } from '../../../domain/ai/AiContextBuilder';

export interface SendChatMessageInput {
  /** Optional ID of the thread to auto-persist user and assistant message turns. */
  threadId?: string;
  messages: AiChatMessage[];
  document?: {
    id: string;
    title?: string;
    markdown: string;
  };
  selection?: {
    text: string;
    surroundingHeading?: string;
    source?: string;
  };
  mode?: AiTutorMode;
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
 */
export class SendChatMessageUseCase {
  private readonly aiService: AiService;
  private readonly chatRepo?: AiChatRepository;

  constructor(aiService: AiService, chatRepo?: AiChatRepository) {
    this.aiService = aiService;
    this.chatRepo = chatRepo;
  }

  async *execute(input: SendChatMessageInput): AsyncIterable<AiStreamEvent> {
    if (!input.messages || input.messages.length === 0) {
      yield* createValidationError('At least one message is required to send a chat request.');
      return;
    }

    const documentContext = AiContextBuilder.buildDocumentContext(input.document);
    const selection = AiContextBuilder.buildSelectionContext(input.selection);
    const mode: AiTutorMode = input.mode ?? 'assistant';
    const threadId = input.threadId;

    let lastUserTimestamp: string | undefined;

    // 1. Persist the latest user turn if threadId is provided
    if (this.chatRepo && threadId) {
      const lastMessage = input.messages[input.messages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        lastUserTimestamp = lastMessage.createdAt;
        const userRecord: AiMessageRecord = {
          id: lastMessage.id,
          threadId,
          role: 'user',
          content: lastMessage.content,
          status: 'complete',
          createdAt: lastMessage.createdAt,
        };
        await this.chatRepo.saveMessage(userRecord);
      }
    }

    // 2. Start streaming inference (outside of any database transaction)
    let accumulatedText = '';
    let activeAssistantId: string | null = null;
    let finalUsage: AiUsage | undefined;
    let streamError: { code: string; message: string } | null = null;

    try {
      const stream = this.aiService.streamChat({
        messages: input.messages,
        documentContext,
        selection,
        mode,
        signal: input.signal,
      });

      for await (const event of stream) {
        if (input.signal?.aborted) break;

        switch (event.type) {
          case 'start':
            activeAssistantId = event.messageId;
            break;
          case 'token':
            accumulatedText += event.text;
            break;
          case 'done':
            finalUsage = event.usage;
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
      // 3. Atomically persist completed or interrupted assistant turn if threadId is provided
      if (this.chatRepo && threadId && !input.signal?.aborted) {
        const assistantId = activeAssistantId || `assistant-${crypto.randomUUID()}`;
        const userTime = lastUserTimestamp ? new Date(lastUserTimestamp).getTime() : 0;
        const nowTime = Date.now();
        const assistantTime = Math.max(nowTime, userTime + 1);
        const now = new Date(assistantTime).toISOString();

        if (streamError) {
          await this.chatRepo.saveMessage({
            id: assistantId,
            threadId,
            role: 'assistant',
            content: accumulatedText,
            status: 'error',
            createdAt: now,
            metadata: {
              errorCode: streamError.code,
              errorMessage: streamError.message,
            },
          });
        } else if (accumulatedText) {
          await this.chatRepo.saveMessage({
            id: assistantId,
            threadId,
            role: 'assistant',
            content: accumulatedText,
            status: 'complete',
            createdAt: now,
            metadata: {
              usage: finalUsage,
            },
          });
        }
      }
    }
  }
}
