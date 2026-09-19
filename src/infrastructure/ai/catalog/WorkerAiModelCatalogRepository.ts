import type { AiModelCatalogRepository } from '../../../domain/ai/repositories/AiModelCatalogRepository';
import {
  DEFAULT_AI_MODEL_CATALOG,
  isAiModelCatalog,
  pickNewerAiModelCatalog,
  type AiModelCatalog,
} from '../../../domain/ai/services/aiModelCatalog';

/** Cache key is versioned so a future shape change can abandon old entries instead of parsing them. */
const CACHE_KEY = 'lunaclair.ai-model-catalog.v1';

/** A catalog fetch must never stall the app: the bundled mirror answers immediately either way. */
const FETCH_TIMEOUT_MS = 5_000;

interface CachedCatalogEnvelope {
  catalog: AiModelCatalog;
}

export interface WorkerAiModelCatalogRepositoryOptions {
  /** Base URL for API requests. Defaults to '' (relative to current origin / proxy). */
  baseUrl?: string;
  /** Storage used for the last successful catalog. Defaults to `localStorage` when available. */
  storage?: Storage;
}

/**
 * Reads the AI model catalog from the Worker, falling back to the last cached catalog and finally to
 * the bundled mirror.
 *
 * Offline-first by contract: the app prices turns and meters requests without a network, so a failed
 * fetch is a normal outcome rather than an error. The newest of {fetched, cached, bundled} wins, and
 * the Worker stays authoritative by version — a cached catalog can never outrank a newer bundle, and
 * a bundle can never outrank a newer served catalog.
 */
export class WorkerAiModelCatalogRepository implements AiModelCatalogRepository {
  private readonly baseUrl: string;
  private readonly storage: Storage | undefined;
  /** In-flight dedupe: concurrent callers share one fetch instead of stampeding the endpoint. */
  private pending: Promise<AiModelCatalog> | null = null;

  constructor(options: WorkerAiModelCatalogRepositoryOptions = {}) {
    this.baseUrl = options.baseUrl ?? '';
    this.storage =
      options.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
  }

  async getCatalog(): Promise<AiModelCatalog> {
    if (!this.pending) {
      this.pending = this.loadCatalog();
    }
    try {
      return await this.pending;
    } finally {
      // A failed load is retried on the next call; a successful one stays memoized.
      this.pending = null;
    }
  }

  private async loadCatalog(): Promise<AiModelCatalog> {
    const cached = this.readCache();
    const fetched = await this.fetchCatalog();
    if (fetched) this.writeCache(fetched);

    return pickNewerAiModelCatalog(pickNewerAiModelCatalog(fetched, cached), DEFAULT_AI_MODEL_CATALOG) ??
      DEFAULT_AI_MODEL_CATALOG;
  }

  private async fetchCatalog(): Promise<AiModelCatalog | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/models`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) return null;

      const payload: unknown = await response.json();
      return isAiModelCatalog(payload) ? payload : null;
    } catch {
      // Offline, timed out, or the endpoint answered something that is not a catalog.
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private readCache(): AiModelCatalog | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CachedCatalogEnvelope>;
      return isAiModelCatalog(parsed.catalog) ? parsed.catalog : null;
    } catch {
      return null;
    }
  }

  private writeCache(catalog: AiModelCatalog): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(CACHE_KEY, JSON.stringify({ catalog } satisfies CachedCatalogEnvelope));
    } catch {
      // A full or unavailable storage must not fail a request that already succeeded.
    }
  }
}
