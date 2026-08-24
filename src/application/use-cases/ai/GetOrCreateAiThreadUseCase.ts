import type { AiChatRepository } from '../../../domain/ai/AiChatRepository';
import type { AiThread, AiTutorMode } from '../../../domain/ai/ai.types';

export interface GetOrCreateAiThreadInput {
  materialId?: string;
  mode: AiTutorMode;
  title?: string;
}

/**
 * Retrieves the latest active thread for the given scope (materialId + mode)
 * or creates a new one deterministically.
 */
export class GetOrCreateAiThreadUseCase {
  private readonly chatRepo: AiChatRepository;

  constructor(chatRepo: AiChatRepository) {
    this.chatRepo = chatRepo;
  }

  async execute(input: GetOrCreateAiThreadInput): Promise<AiThread> {
    const existing = await this.chatRepo.findLatestThread(input.materialId, input.mode);
    if (existing) {
      return existing;
    }

    const modeName = input.mode.charAt(0).toUpperCase() + input.mode.slice(1);
    const defaultTitle = input.materialId
      ? `${modeName} Study Session`
      : `Global ${modeName} Session`;

    const now = new Date().toISOString();
    const newThread: AiThread = {
      id: `thread-${crypto.randomUUID()}`,
      materialId: input.materialId,
      title: input.title?.trim() || defaultTitle,
      mode: input.mode,
      createdAt: now,
      updatedAt: now,
    };

    await this.chatRepo.saveThread(newThread);
    return newThread;
  }
}
