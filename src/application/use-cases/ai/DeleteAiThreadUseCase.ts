import type { AiChatRepository } from '../../../domain/ai/repositories/AiChatRepository';

export interface DeleteAiThreadInput {
  threadId: string;
}

/**
 * Deletes an AI thread and cascades deletion of all associated messages.
 */
export class DeleteAiThreadUseCase {
  private readonly chatRepo: AiChatRepository;

  constructor(chatRepo: AiChatRepository) {
    this.chatRepo = chatRepo;
  }

  async execute(input: DeleteAiThreadInput): Promise<void> {
    if (!input.threadId) return;
    await this.chatRepo.deleteThread(input.threadId);
  }
}
