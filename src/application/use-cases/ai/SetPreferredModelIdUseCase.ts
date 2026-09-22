import type { PreferencesRepository } from '../../../domain/preferences/repositories/PreferencesRepository';

/**
 * Persists the preferred AI model for the next request.
 *
 * Device-local like its sibling preferences: not a sync entity, excluded from
 * package export/import. The stored id is a hint — catalog resolution on read
 * turns a retired or unknown id into the catalog default.
 */
export class SetPreferredModelIdUseCase {
  private readonly preferencesRepo: PreferencesRepository;

  constructor(preferencesRepo: PreferencesRepository) {
    this.preferencesRepo = preferencesRepo;
  }

  async execute(modelId: string): Promise<void> {
    await this.preferencesRepo.setPreferredModelId(modelId);
  }
}
