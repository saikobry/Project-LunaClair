import type { AiService } from '../../../domain/ai/AiService';
import type {
  AiChatMessage,
  AiStreamEvent,
  AiTutorMode,
} from '../../../domain/ai/ai.types';
import { AiContextBuilder } from './AiContextBuilder';

export interface SendChatMessageInput {
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
 * Coordinates context construction via AiContextBuilder and delegates to AiService.
 */
export class SendChatMessageUseCase {
  private readonly aiService: AiService;

  constructor(aiService: AiService) {
    this.aiService = aiService;
  }

  execute(input: SendChatMessageInput): AsyncIterable<AiStreamEvent> {
    if (!input.messages || input.messages.length === 0) {
      return createValidationError('At least one message is required to send a chat request.');
    }

    const documentContext = AiContextBuilder.buildDocumentContext(input.document);
    const selection = AiContextBuilder.buildSelectionContext(input.selection);
    const mode: AiTutorMode = input.mode ?? 'assistant';

    return this.aiService.streamChat({
      messages: input.messages,
      documentContext,
      selection,
      mode,
      signal: input.signal,
    });
  }
}
