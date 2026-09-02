import type { AiChatRepository } from '../../../domain/ai/repositories/AiChatRepository';
import type { AiMessageRecord } from '../../../domain/ai/models/ai.types';

export interface GetAiThreadMessagesInput {
  threadId: string;
}

/**
 * Retrieves all chronological messages for a specific AI conversation thread.
 */
export class GetAiThreadMessagesUseCase {
  private readonly chatRepo: AiChatRepository;

  constructor(chatRepo: AiChatRepository) {
    this.chatRepo = chatRepo;
  }

  async execute(input: GetAiThreadMessagesInput): Promise<AiMessageRecord[]> {
    if (!input.threadId) {
      return [];
    }
    return this.chatRepo.getMessages(input.threadId);
  }
}
