import { describe, expect, it } from 'vitest';
import {
  AI_CATALOG_VERSION,
  AI_DEFAULT_MODEL_ID,
  AI_MODEL_ROUTES,
  hasSingleDefaultModel,
  resolveAiModelRoute,
  toPublicAiModelCatalog,
} from '../aiModels';

describe('AI_MODEL_ROUTES', () => {
  it('declares exactly one default model', () => {
    expect(hasSingleDefaultModel()).toBe(true);
  });

  it('keeps every id unique', () => {
    const ids = AI_MODEL_ROUTES.map((route) => route.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every model a positive window, output reservation, and document budget', () => {
    for (const route of AI_MODEL_ROUTES) {
      expect(route.contextWindowTokens, route.id).toBeGreaterThan(0);
      expect(route.maxOutputTokens, route.id).toBeGreaterThan(0);
      expect(route.maxOutputTokens, route.id).toBeLessThan(route.contextWindowTokens);
      expect(route.maxDocumentContextChars, route.id).toBeGreaterThan(0);
    }
  });

  it('prices every priced model with positive rates', () => {
    for (const route of AI_MODEL_ROUTES) {
      if (!route.pricing) continue;
      expect(route.pricing.inputPerMillionUsd, route.id).toBeGreaterThan(0);
      expect(route.pricing.outputPerMillionUsd, route.id).toBeGreaterThan(0);
    }
  });
});

describe('resolveAiModelRoute', () => {
  it('resolves an absent id to the default model', () => {
    expect(resolveAiModelRoute()?.id).toBe(AI_DEFAULT_MODEL_ID);
    expect(resolveAiModelRoute(undefined)?.id).toBe(AI_DEFAULT_MODEL_ID);
  });

  it('resolves a named model by its catalog id', () => {
    expect(resolveAiModelRoute('ukisai-swift-max')?.providerModelId).toBe('swift');
  });

  it('resolves an unknown id to undefined rather than substituting the default', () => {
    // Substituting would bill the user for an answer they did not ask for.
    expect(resolveAiModelRoute('does-not-exist')).toBeUndefined();
  });
});

describe('toPublicAiModelCatalog', () => {
  it('serves the version and default the client caches against', () => {
    const catalog = toPublicAiModelCatalog();

    expect(catalog.version).toBe(AI_CATALOG_VERSION);
    expect(catalog.defaultModelId).toBe(AI_DEFAULT_MODEL_ID);
    expect(catalog.models).toHaveLength(AI_MODEL_ROUTES.length);
  });

  it('never leaks provider routing data', () => {
    for (const model of toPublicAiModelCatalog().models) {
      expect(model).not.toHaveProperty('provider');
      expect(model).not.toHaveProperty('providerModelId');
    }
  });

  it('carries display names the client can render without its own model table', () => {
    const names = toPublicAiModelCatalog().models.map((model) => model.display.name);

    expect(names).toContain('MAX');
    expect(names).toContain('Standard');
  });
});
