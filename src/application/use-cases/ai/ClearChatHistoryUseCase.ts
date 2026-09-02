import type { AiChatRepository } from '../../../domain/ai/repositories/AiChatRepository';

export interface ClearChatHistoryInput {
  /** If provided, clears threads for this material. If omitted, clears all threads. */
  materialId?: string;
}

/**
 * Clears AI chat history locally either for a specific study material or application-wide.
 */
export class ClearChatHistoryUseCase {
  private readonly chatRepo: AiChatRepository;

  constructor(chatRepo: AiChatRepository) {
    this.chatRepo = chatRepo;
  }

  async execute(input: ClearChatHistoryInput = {}): Promise<void> {
    if (input.materialId !== undefined) {
      await this.chatRepo.clearMaterialThreads(input.materialId);
    } else {
      await this.chatRepo.clearAllThreads();
    }
  }
}
