import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerAiModelCatalogRepository } from '../WorkerAiModelCatalogRepository';
import {
  DEFAULT_AI_MODEL_CATALOG,
  type AiModelCatalog,
} from '../../../../domain/ai/services/aiModelCatalog';

const CACHE_KEY = 'lunaclair.ai-model-catalog.v1';

/** Minimal in-memory Storage so the test never depends on jsdom's localStorage contents. */
function createStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

function servedCatalog(version: string): AiModelCatalog {
  return { ...DEFAULT_AI_MODEL_CATALOG, version };
}

describe('WorkerAiModelCatalogRepository', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the served catalog and caches it', async () => {
    const storage = createStorage();
    const served = servedCatalog('2099-01-01.1');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => served,
    } as unknown as Response);

    const catalog = await new WorkerAiModelCatalogRepository({ storage }).getCatalog();

    expect(catalog.version).toBe('2099-01-01.1');
    expect(JSON.parse(storage.getItem(CACHE_KEY) ?? '{}')).toMatchObject({
      catalog: { version: '2099-01-01.1' },
    });
  });

  it('falls back to the cached catalog when the network fails', async () => {
    const storage = createStorage();
    storage.setItem(CACHE_KEY, JSON.stringify({ catalog: servedCatalog('2099-01-01.1') }));
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    const catalog = await new WorkerAiModelCatalogRepository({ storage }).getCatalog();

    expect(catalog.version).toBe('2099-01-01.1');
  });

  it('falls back to the bundled mirror when nothing is cached and the network fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    const catalog = await new WorkerAiModelCatalogRepository({ storage: createStorage() }).getCatalog();

    expect(catalog).toEqual(DEFAULT_AI_MODEL_CATALOG);
  });

  it('prefers the bundled mirror when it is newer than the cache', async () => {
    const storage = createStorage();
    storage.setItem(CACHE_KEY, JSON.stringify({ catalog: servedCatalog('2020-01-01.1') }));
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    const catalog = await new WorkerAiModelCatalogRepository({ storage }).getCatalog();

    expect(catalog.version).toBe(DEFAULT_AI_MODEL_CATALOG.version);
  });

  it('ignores a served payload that is not a catalog', async () => {
    const storage = createStorage();
    storage.setItem(CACHE_KEY, JSON.stringify({ catalog: servedCatalog('2099-01-01.1') }));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ nope: true }),
    } as unknown as Response);

    const catalog = await new WorkerAiModelCatalogRepository({ storage }).getCatalog();

    expect(catalog.version).toBe('2099-01-01.1');
  });

  it('ignores an unparseable cache entry instead of throwing', async () => {
    const storage = createStorage();
    storage.setItem(CACHE_KEY, '{not json');
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    const catalog = await new WorkerAiModelCatalogRepository({ storage }).getCatalog();

    expect(catalog).toEqual(DEFAULT_AI_MODEL_CATALOG);
  });

  it('does not fail the load when storage rejects a write', async () => {
    const storage = createStorage();
    storage.setItem = () => {
      throw new Error('quota exceeded');
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => servedCatalog('2099-01-01.1'),
    } as unknown as Response);

    await expect(
      new WorkerAiModelCatalogRepository({ storage }).getCatalog(),
    ).resolves.toMatchObject({ version: '2099-01-01.1' });
  });

  it('queries the catalog endpoint', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    globalThis.fetch = fetchMock;

    await new WorkerAiModelCatalogRepository({ baseUrl: 'https://api.test', storage: createStorage() }).getCatalog();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/ai/models',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
