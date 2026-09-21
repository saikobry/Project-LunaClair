import type { PreferencesRepository } from '../../../domain/preferences/repositories/PreferencesRepository';
import type { AiSelectionThreadMode } from '../../../domain/ai/models/ai.types';

/**
 * Persists where reader selection actions (Explain / Simplify / Example) send
 * their turn: the material's newest conversation, or a distinct new one.
 *
 * Device-local like every preference: it is not a sync entity and is excluded
 * from package export/import, exactly like AI history.
 */
export class SetSelectionThreadModeUseCase {
  private readonly preferencesRepo: PreferencesRepository;

  constructor(preferencesRepo: PreferencesRepository) {
    this.preferencesRepo = preferencesRepo;
  }

  async execute(mode: AiSelectionThreadMode): Promise<void> {
    await this.preferencesRepo.setAiSelectionThreadMode(mode);
  }
}
