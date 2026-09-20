import { describe, expect, it } from 'vitest';
import {
  AI_CATALOG_VERSION,
  AI_DEFAULT_MODEL_ID,
  AI_MODEL_ROUTES,
  toPublicAiModelCatalog,
} from '../aiModels';
// The client cannot import from `worker/`, so its catalog is a documented copy of the registry
// above. This test is the only place that can see both, which makes it the guard against drift:
// a mirror that misses a model, or that carries stale budgets, prices, or display text, would
// silently mis-meter the drawer or offer a choice the endpoint refuses.
import {
  AI_CATALOG_VERSION as CLIENT_CATALOG_VERSION,
  DEFAULT_AI_MODEL_CATALOG,
  isAiCatalogVersion,
} from '../../../../src/domain/ai/services/aiModelCatalog';
import { AI_FIRST_EVENT_TIMEOUT_MS } from '../../ai/deadline';
import { AI_FIRST_TOKEN_TIMEOUT_MS } from '../../../../src/features/ai/utils/aiActivity';

describe('client catalog mirror ↔ Worker registry coherence', () => {
  it('lets the Worker give up on a silent provider before the client does', () => {
    // The two timeouts measure the same thing from opposite ends, and their order decides which
    // message a user sees. If the client watchdog fires first, its generic "did not start
    // responding" is all anyone gets and the Worker's coded, model-attributed answer never
    // arrives — so the server deadline has to be the tighter of the two.
    expect(AI_FIRST_EVENT_TIMEOUT_MS).toBeLessThan(AI_FIRST_TOKEN_TIMEOUT_MS);
  });

  it('agrees on the catalog version', () => {
    expect(CLIENT_CATALOG_VERSION).toBe(AI_CATALOG_VERSION);
    expect(DEFAULT_AI_MODEL_CATALOG.version).toBe(AI_CATALOG_VERSION);
  });

  it('uses a version label the client can order numerically', () => {
    // The client compares catalog versions field-by-field, so a version it cannot parse would be
    // ranked below a well-formed one rather than compared — i.e. silently never adopted.
    expect(isAiCatalogVersion(AI_CATALOG_VERSION)).toBe(true);
  });

  it('agrees on the default model', () => {
    expect(DEFAULT_AI_MODEL_CATALOG.defaultModelId).toBe(AI_DEFAULT_MODEL_ID);
  });

  it('registers exactly the same models, by id', () => {
    const registryIds = AI_MODEL_ROUTES.map((route) => route.id).sort();
    const mirrorIds = DEFAULT_AI_MODEL_CATALOG.models.map((model) => model.id).sort();

    expect(mirrorIds).toEqual(registryIds);
  });

  it('agrees on every model fact the client meters or prices with', () => {
    for (const route of AI_MODEL_ROUTES) {
      const mirror = DEFAULT_AI_MODEL_CATALOG.models.find((model) => model.id === route.id);
      expect(mirror, route.id).toBeDefined();

      expect(mirror?.display, route.id).toEqual(route.display);
      expect(mirror?.contextWindowTokens, route.id).toBe(route.contextWindowTokens);
      expect(mirror?.maxOutputTokens, route.id).toBe(route.maxOutputTokens);
      expect(mirror?.maxDocumentContextChars, route.id).toBe(route.maxDocumentContextChars);
      expect(mirror?.pricing, route.id).toEqual(route.pricing);
      // The mirror is the only client-side home for routing facts: historic turns recorded the
      // provider's own model id, and resolving them back to their facts needs this mapping.
      expect(mirror?.provider, route.id).toBe(route.provider);
      expect(mirror?.providerModelId, route.id).toBe(route.providerModelId);
    }
  });

  it('describes every servable model in the public catalog the client receives', () => {
    const served = toPublicAiModelCatalog();
    for (const model of served.models) {
      const mirror = DEFAULT_AI_MODEL_CATALOG.models.find((entry) => entry.id === model.id);
      expect(mirror, model.id).toBeDefined();
      expect(mirror?.display).toEqual(model.display);
      expect(mirror?.contextWindowTokens).toBe(model.contextWindowTokens);
    }
  });
});
