import type { AiModelCatalogRepository } from '../../../domain/ai/repositories/AiModelCatalogRepository';
import {
  DEFAULT_AI_MODEL_CATALOG,
  isAiCatalogDisabled,
  isAiModelCatalog,
  pickNewerAiModelCatalog,
  type AiModelCatalog,
} from '../../../domain/ai/services/aiModelCatalog';

/** Cache key is versioned so a future shape change can abandon old entries instead of parsing them. */
const CACHE_KEY = 'lunaclair.ai-model-catalog.v3';

/** A catalog fetch must never stall the app: the bundled mirror answers immediately either way. */
const FETCH_TIMEOUT_MS = 5_000;

/**
 * How long a cached catalog stays usable while the endpoint cannot be reached.
 *
 * A cached catalog is a *guess about the present*, and the facts it carries include which models
 * exist at all — a retired model left authoritative forever means the picker keeps offering a choice
 * that a server no longer serves. Past this age the cache is dropped and the bundled mirror (as
 * fresh as the app build) answers instead.
 */
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

interface CachedCatalogEnvelope {
  catalog: AiModelCatalog;
  /** Epoch ms of the successful fetch this catalog came from. */
  fetchedAt: number;
}

export interface WorkerAiModelCatalogRepositoryOptions {
  /** Base URL for API requests. Defaults to '' (relative to current origin / proxy). */
  baseUrl?: string;
  /** Storage used for the last successful catalog. Defaults to `localStorage` when available. */
  storage?: Storage;
  /** Injectable clock, so the freshness policy is testable without waiting a day. */
  now?: () => number;
}

/**
 * Reads the AI model catalog from the Worker, falling back to the last cached catalog and finally to
 * the bundled mirror.
 *
 * Precedence is **not** a version comparison at the top: a fetch that succeeds is live truth and
 * wins outright, because the server is the only party that knows which models exist *now* (removing
 * a model is a change to the catalog, not only a bump to its version). Version comparison then
 * arbitrates between the two offline sources — a cache and the mirror bundled with this app build —
 * so a stale cache can never outrank a newer app.
 *
 * Offline-first by contract: the app prices turns and meters requests without a network, so a failed
 * fetch is a normal outcome rather than an error. Only the freshness of the cache is bounded; the
 * mirror has no expiry because it cannot be newer than the app around it.
 */
export class WorkerAiModelCatalogRepository implements AiModelCatalogRepository {
  private readonly baseUrl: string;
  private readonly storage: Storage | undefined;
  private readonly now: () => number;
  /** In-flight dedupe: concurrent callers share one fetch instead of stampeding the endpoint. */
  private pending: Promise<AiModelCatalog> | null = null;

  constructor(options: WorkerAiModelCatalogRepositoryOptions = {}) {
    this.baseUrl = options.baseUrl ?? '';
    this.storage =
      options.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
    this.now = options.now ?? (() => Date.now());
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
    const fetched = await this.fetchCatalog();
    if (fetched) {
      // An emergency shutdown is **never** persisted: storing it would turn a deployment's deliberate
      // "off right now" into this device's answer for the next 24 hours, long after the switch is
      // flipped back. A live disabled response still governs the query that received it.
      if (!isAiCatalogDisabled(fetched)) this.writeCache(fetched);
      return fetched;
    }

    const cached = this.readCache();
    return pickNewerAiModelCatalog(cached, DEFAULT_AI_MODEL_CATALOG) ?? DEFAULT_AI_MODEL_CATALOG;
  }

  /**
   * Accepts a catalog payload and fills in the facts an older one did not carry.
   *
   * `availability` is newer than the endpoint: a response from a build that predates it means
   * "available", because that is what it was serving when it was written.
   */
  private static parseCatalog(value: unknown): AiModelCatalog | null {
    if (!isAiModelCatalog(value)) return null;
    return { ...value, availability: value.availability ?? 'available' };
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
      return WorkerAiModelCatalogRepository.parseCatalog(payload);
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
      if (typeof parsed.fetchedAt !== 'number') return null;
      if (this.now() - parsed.fetchedAt > CACHE_MAX_AGE_MS) return null;
      return WorkerAiModelCatalogRepository.parseCatalog(parsed.catalog);
    } catch {
      return null;
    }
  }

  private writeCache(catalog: AiModelCatalog): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(
        CACHE_KEY,
        JSON.stringify({ catalog, fetchedAt: this.now() } satisfies CachedCatalogEnvelope),
      );
    } catch {
      // A full or unavailable storage must not fail a request that already succeeded.
    }
  }
}
