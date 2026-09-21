import type { AiChatRepository } from '../../../domain/ai/repositories/AiChatRepository';
import type { PreferencesRepository } from '../../../domain/preferences/repositories/PreferencesRepository';
import type { AiGroundingMode, AiThread } from '../../../domain/ai/models/ai.types';

export interface CreateAiThreadInput {
  /** Optional study material ID. If undefined, the session belongs to the global assistant. */
  materialId?: string;
  /** Explicit session title. Falls back to a generic label until the first prompt names it. */
  title?: string;
  /**
   * Explicit grounding mode. Omitted, a material-scoped thread takes the stored default for new
   * conversations; a global thread is always `'none'`.
   */
  grounding?: AiGroundingMode;
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
  private readonly preferencesRepo: PreferencesRepository;

  constructor(chatRepo: AiChatRepository, preferencesRepo: PreferencesRepository) {
    this.chatRepo = chatRepo;
    this.preferencesRepo = preferencesRepo;
  }

  async execute(input: CreateAiThreadInput = {}): Promise<AiThread> {
    const now = new Date().toISOString();

    const thread: AiThread = {
      id: `thread-${crypto.randomUUID()}`,
      materialId: input.materialId,
      title: input.title?.trim() || (input.materialId ? 'New chat' : 'New global chat'),
      grounding: await this.resolveGrounding(input),
      createdAt: now,
      updatedAt: now,
    };

    await this.chatRepo.saveThread(thread);
    return thread;
  }

  /**
   * Grounding a global thread is rejected rather than coerced: a thread with no material has no
   * document to attach, so asking for one is a caller bug. Reads recover from corrupt rows (see
   * `DexieAiChatRepository.normalizeThreadRow`), but writes must not create them.
   */
  private async resolveGrounding(input: CreateAiThreadInput): Promise<AiGroundingMode> {
    if (input.materialId === undefined) {
      if (input.grounding === 'whole') {
        throw new Error('A global AI thread cannot be grounded in a study material.');
      }
      return 'none';
    }

    if (input.grounding !== undefined) return input.grounding;

    return this.preferencesRepo.getAiGroundingDefault();
  }
}
