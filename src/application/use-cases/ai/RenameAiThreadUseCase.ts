import type { AiChatRepository } from '../../../domain/ai/repositories/AiChatRepository';
import type { AiThread } from '../../../domain/ai/models/ai.types';

export interface RenameAiThreadInput {
  threadId: string;
  title: string;
}

/**
 * Retitles an AI conversation session.
 *
 * Deliberately does not touch `updatedAt`: recency must keep tracking
 * conversation activity, so renaming an old session never reorders history.
 *
 * Writes through a title-only partial update rather than re-saving a whole read object, so a
 * grounding toggle landing between the read and the write is not reverted by a stale copy.
 * Returns null when the thread is gone or the title is blank.
 */
export class RenameAiThreadUseCase {
  private readonly chatRepo: AiChatRepository;

  constructor(chatRepo: AiChatRepository) {
    this.chatRepo = chatRepo;
  }

  async execute(input: RenameAiThreadInput): Promise<AiThread | null> {
    const title = input.title?.trim();
    if (!input.threadId || !title) {
      return null;
    }

    const thread = await this.chatRepo.getThread(input.threadId);
    if (!thread) {
      return null;
    }

    await this.chatRepo.setTitle(input.threadId, title);
    return { ...thread, title };
  }
}
