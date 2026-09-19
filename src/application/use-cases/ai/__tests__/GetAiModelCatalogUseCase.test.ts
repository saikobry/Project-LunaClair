import { describe, expect, it, vi } from 'vitest';
import { GetAiModelCatalogUseCase } from '../GetAiModelCatalogUseCase';
import type { AiModelCatalogRepository } from '../../../../domain/ai/repositories/AiModelCatalogRepository';
import { DEFAULT_AI_MODEL_CATALOG } from '../../../../domain/ai/services/aiModelCatalog';

function createRepository(): AiModelCatalogRepository {
  return { getCatalog: vi.fn().mockResolvedValue(DEFAULT_AI_MODEL_CATALOG) };
}

describe('GetAiModelCatalogUseCase', () => {
  it('returns the repository catalog unchanged', async () => {
    const repository = createRepository();
    const catalog = await new GetAiModelCatalogUseCase(repository).execute();

    expect(catalog).toEqual(DEFAULT_AI_MODEL_CATALOG);
    expect(repository.getCatalog).toHaveBeenCalledTimes(1);
  });

  it('propagates a repository failure rather than inventing a catalog', async () => {
    // The repository owns the fallback chain; a use case that swallowed a failure here would hide
    // a broken chain behind a silently stale catalog.
    const repository: AiModelCatalogRepository = {
      getCatalog: vi.fn().mockRejectedValue(new Error('boom')),
    };

    await expect(new GetAiModelCatalogUseCase(repository).execute()).rejects.toThrow('boom');
  });
});
