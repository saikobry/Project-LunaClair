import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerAiModelCatalogRepository } from '../WorkerAiModelCatalogRepository';
import {
  DEFAULT_AI_MODEL_CATALOG,
  type AiModelCatalog,
} from '../../../../domain/ai/services/aiModelCatalog';

const CACHE_KEY = 'lunaclair.ai-model-catalog.v2';
const ONE_DAY_MS = 24 * 60 * 60 * 1_000;

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

/** Seeded cache entries must be dated, or the freshness policy treats them as unusable. */
function cacheEntry(catalog: AiModelCatalog, fetchedAt: number): string {
  return JSON.stringify({ catalog, fetchedAt });
}

describe('WorkerAiModelCatalogRepository', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the served catalog and caches it with the time it was fetched', async () => {
    const storage = createStorage();
    const served = servedCatalog('2099-01-01.1');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => served,
    } as unknown as Response);

    const catalog = await new WorkerAiModelCatalogRepository({
      storage,
      now: () => 1_700_000_000_000,
    }).getCatalog();

    expect(catalog.version).toBe('2099-01-01.1');
    expect(JSON.parse(storage.getItem(CACHE_KEY) ?? '{}')).toMatchObject({
      catalog: { version: '2099-01-01.1' },
      fetchedAt: 1_700_000_000_000,
    });
  });

  it('falls back to the cached catalog when the network fails', async () => {
    const storage = createStorage();
    storage.setItem(CACHE_KEY, cacheEntry(servedCatalog('2099-01-01.1'), Date.now()));
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    const catalog = await new WorkerAiModelCatalogRepository({ storage }).getCatalog();

    expect(catalog.version).toBe('2099-01-01.1');
  });

  it('trusts a fresh fetch over the cache even when the cache claims a newer version', async () => {
    const storage = createStorage();
    // A model removal does not reorder versions, so live truth must not lose a version comparison.
    storage.setItem(CACHE_KEY, cacheEntry(servedCatalog('2099-01-01.1'), Date.now()));
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => servedCatalog('2026-09-20.1'),
    } as unknown as Response);

    const catalog = await new WorkerAiModelCatalogRepository({ storage }).getCatalog();

    expect(catalog.version).toBe('2026-09-20.1');
  });

  it('drops a cache older than the freshness window', async () => {
    const storage = createStorage();
    const now = 1_700_000_000_000;
    storage.setItem(CACHE_KEY, cacheEntry(servedCatalog('2099-01-01.1'), now - ONE_DAY_MS - 1));
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    const catalog = await new WorkerAiModelCatalogRepository({
      storage,
      now: () => now,
    }).getCatalog();

    // A retired model left authoritative forever would keep being offered by the picker.
    expect(catalog).toEqual(DEFAULT_AI_MODEL_CATALOG);
  });

  it('keeps a cache that is inside the freshness window', async () => {
    const storage = createStorage();
    const now = 1_700_000_000_000;
    storage.setItem(CACHE_KEY, cacheEntry(servedCatalog('2099-01-01.1'), now - 1_000));
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    const catalog = await new WorkerAiModelCatalogRepository({
      storage,
      now: () => now,
    }).getCatalog();

    expect(catalog.version).toBe('2099-01-01.1');
  });

  it('ignores a dated-but-undated legacy entry rather than trusting an unknown age', async () => {
    const storage = createStorage();
    storage.setItem(
      'lunaclair.ai-model-catalog.v1',
      JSON.stringify({ catalog: servedCatalog('2099-01-01.1') }),
    );
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    const catalog = await new WorkerAiModelCatalogRepository({ storage }).getCatalog();

    expect(catalog).toEqual(DEFAULT_AI_MODEL_CATALOG);
  });

  it('falls back to the bundled mirror when nothing is cached and the network fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    const catalog = await new WorkerAiModelCatalogRepository({ storage: createStorage() }).getCatalog();

    expect(catalog).toEqual(DEFAULT_AI_MODEL_CATALOG);
  });

  it('prefers the bundled mirror when it is newer than the cache', async () => {
    const storage = createStorage();
    storage.setItem(CACHE_KEY, cacheEntry(servedCatalog('2020-01-01.1'), Date.now()));
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

    const catalog = await new WorkerAiModelCatalogRepository({ storage }).getCatalog();

    expect(catalog.version).toBe(DEFAULT_AI_MODEL_CATALOG.version);
  });

  it('ignores a served payload that is not a catalog', async () => {
    const storage = createStorage();
    storage.setItem(CACHE_KEY, cacheEntry(servedCatalog('2099-01-01.1'), Date.now()));
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
