/**
 * Client-side model catalog: the facts the app knows about every model it can offer.
 *
 * The **authoritative** catalog is served by `GET /api/ai/models` and cached by the client (see
 * `AiModelCatalogRepository`). This module holds the bundled mirror used when that fetch has never
 * succeeded — a fresh install with no cache, or an offline first run — so the app can still meter a
 * request and price a turn instead of refusing to work.
 *
 * The mirror is a copy of `worker/src/core/aiModels.ts`, which the client cannot import. A fetch
 * that succeeds always wins — the Worker is the only party that knows which models exist *now*,
 * so a cached or bundled copy is only ever an offline stand-in. `version` arbitrates between those
 * two offline sources, and this constant must be bumped whenever the Worker's changes; the
 * worker-side coherence test (`worker/src/core/__tests__/aiModelCatalog.coherence.test.ts`) fails
 * if the two ever disagree on a model, a budget, a price, or the default.
 */

export type AiProviderId = 'workers-ai' | 'ukisai';

/** Published unit pricing, in USD per million tokens. */
export interface AiModelPricing {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

export interface AiModelDisplay {
  name: string;
  tagline?: string;
}

/**
 * Model facts. `providerModelId` exists only so a persisted turn — which records the model that
 * served it, historically the provider's own id — can still be resolved back to its facts.
 */
export interface AiModelDescriptor {
  id: string;
  provider: AiProviderId;
  providerModelId: string;
  display: AiModelDisplay;
  /** Prompt **and** response combined, in tokens. */
  contextWindowTokens: number;
  /** Output tokens each request reserves (the request's `max_tokens`). */
  maxOutputTokens: number;
  /** Characters of study material the model accepts per request. */
  maxDocumentContextChars: number;
  /** `null` = free or unpriced-by-design. Never an invented rate. */
  pricing: AiModelPricing | null;
}

export interface AiModelCatalog {
  /** Changes whenever the facts change; a cached catalog with an older version is stale. */
  version: string;
  defaultModelId: string;
  models: AiModelDescriptor[];
}

export const AI_CATALOG_VERSION = '2026-09-20.1';

const MODELS: readonly AiModelDescriptor[] = Object.freeze([
  Object.freeze({
    id: 'cf-llama-3.3-70b',
    provider: 'workers-ai' as const,
    providerModelId: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    display: { name: 'Standard', tagline: 'Fast, economical everyday assistant' },
    contextWindowTokens: 24_000,
    maxOutputTokens: 4_096,
    maxDocumentContextChars: 16_000,
    pricing: { inputPerMillionUsd: 0.293, outputPerMillionUsd: 2.253 },
  }),
  Object.freeze({
    id: 'ukisai-swift-max',
    provider: 'ukisai' as const,
    providerModelId: 'swift',
    display: { name: 'MAX', tagline: 'Extended context · shared capacity' },
    contextWindowTokens: 262_144,
    maxOutputTokens: 4_096,
    maxDocumentContextChars: 160_000,
    pricing: null,
  }),
]);

/** Bundled fallback catalog — preferred over a cache only when its version is newer. */
export const DEFAULT_AI_MODEL_CATALOG: AiModelCatalog = Object.freeze({
  version: AI_CATALOG_VERSION,
  defaultModelId: 'cf-llama-3.3-70b',
  models: [...MODELS],
});

export const AI_DEFAULT_MODEL_ID: string = DEFAULT_AI_MODEL_CATALOG.defaultModelId;

/**
 * Finds a descriptor by catalog id **or** provider model id, so a turn persisted by an older build
 * (which recorded the provider's own id) still resolves to its facts.
 *
 * Unknown ids resolve to `undefined` on purpose: an unpriced or unmeasured model must render as
 * unknown rather than inherit another model's window or rate.
 */
export function findAiModelDescriptor(
  catalog: AiModelCatalog,
  modelId: string | undefined,
): AiModelDescriptor | undefined {
  if (!modelId) return undefined;
  return catalog.models.find(
    (model) => model.id === modelId || model.providerModelId === modelId,
  );
}

/** Resolves a descriptor, falling back to the catalog default when the id is absent or unknown. */
export function getAiModelDescriptor(
  catalog: AiModelCatalog,
  modelId?: string,
): AiModelDescriptor {
  const found = findAiModelDescriptor(catalog, modelId);
  if (found) return found;
  return (
    findAiModelDescriptor(catalog, catalog.defaultModelId) ?? catalog.models[0]
  );
}

/**
 * Picks the newer of two catalogs by version.
 *
 * Versions are ordered labels (`2026-09-20.1`), not semantic versions, so a lexicographic compare
 * is exact for the fixed-width date prefix and stable for any suffix.
 */
export function pickNewerAiModelCatalog(
  a: AiModelCatalog | null,
  b: AiModelCatalog | null,
): AiModelCatalog | null {
  if (!a) return b;
  if (!b) return a;
  return a.version >= b.version ? a : b;
}

/** Minimal shape check for a catalog read off the network or out of storage. */
export function isAiModelCatalog(value: unknown): value is AiModelCatalog {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AiModelCatalog>;
  if (typeof candidate.version !== 'string' || typeof candidate.defaultModelId !== 'string') {
    return false;
  }
  if (!Array.isArray(candidate.models) || candidate.models.length === 0) return false;
  return candidate.models.every((model) => {
    if (!model || typeof model !== 'object') return false;
    const descriptor = model as Partial<AiModelDescriptor>;
    return (
      typeof descriptor.id === 'string' &&
      typeof descriptor.contextWindowTokens === 'number' &&
      typeof descriptor.maxOutputTokens === 'number' &&
      typeof descriptor.maxDocumentContextChars === 'number' &&
      typeof descriptor.display === 'object' &&
      descriptor.display !== null
    );
  });
}
