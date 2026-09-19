import type { AiChatRepository } from '../../../domain/ai/repositories/AiChatRepository';
import type { AiThread } from '../../../domain/ai/models/ai.types';

export interface CreateAiThreadInput {
  /** Optional study material ID. If undefined, the session belongs to the global assistant. */
  materialId?: string;
  /** Explicit session title. Falls back to a generic label until the first prompt names it. */
  title?: string;
}

/**
 * Creates a brand-new AI conversation session.
 *
 * Unlike a resolve-or-create lookup, this always inserts a distinct session, so
 * "New chat" can never resurrect the previous conversation. The session is
 * renamed from its first prompt by `RenameAiThreadUseCase`.
 */
export class CreateAiThreadUseCase {
  private readonly chatRepo: AiChatRepository;

  constructor(chatRepo: AiChatRepository) {
    this.chatRepo = chatRepo;
  }

  async execute(input: CreateAiThreadInput = {}): Promise<AiThread> {
    const now = new Date().toISOString();

    const thread: AiThread = {
      id: `thread-${crypto.randomUUID()}`,
      materialId: input.materialId,
      title: input.title?.trim() || (input.materialId ? 'New chat' : 'New global chat'),
      createdAt: now,
      updatedAt: now,
    };

    await this.chatRepo.saveThread(thread);
    return thread;
  }
}
