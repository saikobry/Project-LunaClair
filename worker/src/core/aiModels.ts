/**
 * Server-owned AI model registry — the single source of truth for which models `/api/ai/chat` can
 * serve, how each is billed, and how much context each accepts.
 *
 * Two shapes live here on purpose:
 * - `AiModelRoute` is **Worker-internal**. It carries routing and provider facts, including the
 *   provider's own model id, which must never cross the API boundary.
 * - `AiModelCatalog` is the **public projection** served by `GET /api/ai/models` and cached by the
 *   client. The client selects a model by `id` and never learns a provider id, which is what keeps
 *   the client contract stable when a provider is exchanged underneath it.
 *
 * The client keeps a bundled mirror of this catalog (`src/domain/ai/services/aiModelCatalog.ts`) as
 * its offline fallback — the client cannot import from `worker/`, so that mirror is a documented
 * copy, and this endpoint's `version` is how a stale copy is detected.
 */

export type AiProviderId = 'workers-ai' | 'ukisai';

/** Published unit pricing, in USD per million tokens. */
export interface AiModelPricing {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

/** Worker-internal: everything needed to invoke one model and to meter it. */
export interface AiModelRoute {
  /** Stable, app-facing identifier. The client sends this and never a provider model id. */
  id: string;
  provider: AiProviderId;
  /** The provider's own model id, used only for invocation. */
  providerModelId: string;
  /** Prompt **and** response combined, in tokens. */
  contextWindowTokens: number;
  /** Output tokens each request reserves (the request's `max_tokens`). */
  maxOutputTokens: number;
  /** Characters of study material this model accepts per request. */
  maxDocumentContextChars: number;
  /** `null` = the model is free; unknown, never guessed. */
  pricing: AiModelPricing | null;
  display: { name: string; tagline?: string };
  /** Exactly one registered route carries this; it serves requests that name no model. */
  isDefault?: boolean;
  /**
   * Deploy-time availability. `false` retires a model for everyone; the operational kill switch
   * (`AI_DISABLED_MODELS`) does the same without a deploy. Defaults to available.
   */
  available?: boolean;
}

/**
 * Registered models, in display order. Exactly one entry must carry `isDefault`.
 *
 * Bump `AI_CATALOG_VERSION` on any change the client must notice — a new model, a changed budget,
 * or a rate update — because a cached catalog stays authoritative until its version differs.
 */
export const AI_MODEL_ROUTES: readonly AiModelRoute[] = Object.freeze([
  {
    id: 'cf-llama-3.3-70b',
    provider: 'workers-ai',
    providerModelId: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    contextWindowTokens: 24_000,
    maxOutputTokens: 4_096,
    maxDocumentContextChars: 16_000,
    pricing: { inputPerMillionUsd: 0.293, outputPerMillionUsd: 2.253 },
    display: { name: 'Standard', tagline: 'Fast, economical everyday assistant' },
    isDefault: true,
  },
  {
    id: 'ukisai-swift-max',
    provider: 'ukisai',
    providerModelId: 'swift',
    contextWindowTokens: 262_144,
    maxOutputTokens: 4_096,
    maxDocumentContextChars: 160_000,
    // Free for research use, so there is no rate to apply — `null` renders as tokens with no cost.
    pricing: null,
    display: { name: 'MAX', tagline: 'Extended context · shared capacity' },
  },
]);

export const AI_CATALOG_VERSION = '2026-09-20.1';

const DEFAULT_ROUTE = AI_MODEL_ROUTES.find((route) => route.isDefault) ?? AI_MODEL_ROUTES[0];

/** The model a request that names none is served by. */
export const AI_DEFAULT_MODEL_ID: string = DEFAULT_ROUTE.id;

/** Public model facts — routing data is deliberately absent. */
export interface PublicAiModelDescriptor {
  id: string;
  display: { name: string; tagline?: string };
  contextWindowTokens: number;
  maxOutputTokens: number;
  maxDocumentContextChars: number;
  pricing: AiModelPricing | null;
}

export interface AiModelCatalog {
  /** Changes whenever the facts below change; a client cache older than this is stale. */
  version: string;
  defaultModelId: string;
  models: PublicAiModelDescriptor[];
}

/**
 * Projects the internal registry onto the shape the client is allowed to see.
 *
 * Unavailable models are **omitted**, never listed-and-refused: the picker must not offer a choice
 * the endpoint will reject, and a stale cached catalog that still lists one is corrected by the
 * version bump this removal carries.
 */
export function toPublicAiModelCatalog(disabled?: ReadonlySet<string>): AiModelCatalog {
  return {
    version: AI_CATALOG_VERSION,
    defaultModelId: AI_DEFAULT_MODEL_ID,
    models: listServedAiModelRoutes(disabled).map((route) => ({
      id: route.id,
      display: { ...route.display },
      contextWindowTokens: route.contextWindowTokens,
      maxOutputTokens: route.maxOutputTokens,
      maxDocumentContextChars: route.maxDocumentContextChars,
      pricing: route.pricing ? { ...route.pricing } : null,
    })),
  };
}

/**
 * Resolves the model a request should be served by.
 *
 * An absent id means the default. An id that is present but unknown resolves to `undefined` rather
 * than to the default — silently substituting a model would bill the user for an answer they did not
 * ask for, so the caller must fail the request explicitly.
 */
export function resolveAiModelRoute(modelId?: string): AiModelRoute | undefined {
  if (modelId === undefined) return DEFAULT_ROUTE;
  return AI_MODEL_ROUTES.find((route) => route.id === modelId);
}

/**
 * The operational kill switch: models named by `AI_DISABLED_MODELS` stop being served without a
 * deploy.
 *
 * The default route is **exempt**. A switch that can empty the catalog would turn one config change
 * into "the assistant is broken", and the default is the fallback every degraded selection path
 * already resolves to. Disabling it is therefore ignored, loudly. An attempt is only visible in the
 * logs rather than failing the request, because a mistyped variable must not break chat.
 */
export function resolveDisabledAiModelIds(env: { AI_DISABLED_MODELS?: string }): Set<string> {
  const disabled = new Set<string>();
  const raw = env.AI_DISABLED_MODELS;
  if (!raw) return disabled;

  for (const entry of raw.split(',')) {
    const id = entry.trim();
    if (!id) continue;
    if (id === AI_DEFAULT_MODEL_ID) {
      console.warn('AI_DISABLED_MODELS names the default model, which cannot be disabled', { id });
      continue;
    }
    if (!AI_MODEL_ROUTES.some((route) => route.id === id)) {
      console.warn('AI_DISABLED_MODELS names an unknown model', { id });
      continue;
    }
    disabled.add(id);
  }

  return disabled;
}

/** True when the registry and the kill switch both serve this model. */
export function isAiModelServed(
  route: AiModelRoute,
  disabled?: ReadonlySet<string>,
): boolean {
  if (route.isDefault) return true;
  return route.available !== false && !disabled?.has(route.id);
}

/** Registered routes that are currently servable, in display order. */
export function listServedAiModelRoutes(disabled?: ReadonlySet<string>): AiModelRoute[] {
  return AI_MODEL_ROUTES.filter((route) => isAiModelServed(route, disabled));
}

/** True when the registry has exactly one default; asserted by the registry's own test. */
export function hasSingleDefaultModel(): boolean {
  return AI_MODEL_ROUTES.filter((route) => route.isDefault === true).length === 1;
}
