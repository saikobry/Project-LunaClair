import type { AiModelCatalogRepository } from '../../../domain/ai/repositories/AiModelCatalogRepository';
import type { AiModelCatalog } from '../../../domain/ai/services/aiModelCatalog';

/**
 * Resolves the model catalog the UI should offer.
 *
 * The repository owns the merge of fetch, cache, and bundled mirror; this use case is the
 * application-layer seam that keeps features from reaching into infrastructure for it. It never
 * rejects: the catalog has a bundled fallback, so a failure here would leave the drawer unable to
 * meter a request that could otherwise have been sent.
 */
export class GetAiModelCatalogUseCase {
  private readonly repository: AiModelCatalogRepository;

  constructor(repository: AiModelCatalogRepository) {
    this.repository = repository;
  }

  async execute(): Promise<AiModelCatalog> {
    return this.repository.getCatalog();
  }
}
