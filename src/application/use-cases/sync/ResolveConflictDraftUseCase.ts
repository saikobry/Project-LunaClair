import type { ConflictDraftRepository, ResolveConflictInput } from '../../../domain/sync';

export type ResolveConflictDraftInput = ResolveConflictInput;

/**
 * Resolves a diverged document conflict draft by choosing server state, local state,
 * or a manual merge, atomically updating local document content and queuing an outbox mutation.
 */
export class ResolveConflictDraftUseCase {
  private readonly conflictDraftRepo: ConflictDraftRepository;

  constructor(conflictDraftRepo: ConflictDraftRepository) {
    this.conflictDraftRepo = conflictDraftRepo;
  }

  async execute(input: ResolveConflictDraftInput): Promise<void> {
    if (!input.draftId) {
      throw new Error('draftId is required to resolve conflict');
    }

    await this.conflictDraftRepo.resolveConflict(input);
  }
}
