import type { PreferencesRepository } from '../../../domain/preferences/repositories/PreferencesRepository';
import type { AiGroundingMode } from '../../../domain/ai/models/ai.types';

/**
 * Persists whether **new** conversations ground their answers in their material.
 *
 * This one preference is the first live use of the `preferences` store, which was declared but never
 * read or written before. It is device-local: it is not a sync entity and is excluded from package
 * export/import, exactly like AI history. It therefore also moves with any whole-database recovery —
 * a store that is never cleaned up.
 */
export class SetGroundingDefaultUseCase {
  private readonly preferencesRepo: PreferencesRepository;

  constructor(preferencesRepo: PreferencesRepository) {
    this.preferencesRepo = preferencesRepo;
  }

  async execute(mode: AiGroundingMode): Promise<void> {
    await this.preferencesRepo.setAiGroundingDefault(mode);
  }
}
