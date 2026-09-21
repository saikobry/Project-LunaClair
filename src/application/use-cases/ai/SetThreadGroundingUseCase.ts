import type { AiChatRepository } from '../../../domain/ai/repositories/AiChatRepository';
import type { AiGroundingMode } from '../../../domain/ai/models/ai.types';

export interface SetThreadGroundingInput {
  threadId: string;
  grounding: AiGroundingMode;
}

/** Raised when a caller asks to ground a conversation that has no material to ground it in. */
export class GroundingNotAvailableError extends Error {
  readonly code = 'GROUNDING_NOT_AVAILABLE';

  constructor(message = 'A global AI conversation has no study material to ground in.') {
    super(message);
    this.name = 'GroundingNotAvailableError';
  }
}

/**
 * Turns grounding on or off for one conversation.
 *
 * Writes through the repository's partial update rather than re-saving a whole read object, so a
 * concurrent title or recency write on the same thread is not clobbered — and does not bump
 * `updatedAt`, because a settings change must not reorder conversation history.
 *
 * A thread with no material is **rejected**, not coerced. Reads recover from corrupt rows (see
 * `DexieAiChatRepository.normalizeThreadRow`), but a write must not create one: there is no document
 * to attach, so asking for grounding is a caller bug.
 */
export class SetThreadGroundingUseCase {
  private readonly chatRepo: AiChatRepository;

  constructor(chatRepo: AiChatRepository) {
    this.chatRepo = chatRepo;
  }

  async execute(input: SetThreadGroundingInput): Promise<void> {
    const thread = await this.chatRepo.getThread(input.threadId);
    if (!thread) return;

    if (input.grounding === 'whole' && thread.materialId === undefined) {
      throw new GroundingNotAvailableError();
    }

    await this.chatRepo.setGrounding(input.threadId, input.grounding);
  }
}
