import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AI_CATALOG_VERSION,
  AI_DEFAULT_MODEL_ID,
  AI_MODEL_ROUTES,
  hasSingleDefaultModel,
  isAiChatDisabled,
  isAiModelServed,
  listServedAiModelRoutes,
  resolveAiModelRoute,
  resolveDisabledAiModelIds,
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

  it('omits a disabled model rather than listing it to be refused', () => {
    const catalog = toPublicAiModelCatalog(new Set(['ukisai-swift-max']), false);

    expect(catalog.models.map((model) => model.id)).toEqual([AI_DEFAULT_MODEL_ID]);
    expect(catalog.availability).toBe('available');
    expect(catalog.defaultModelId).toBe(AI_DEFAULT_MODEL_ID);
  });

  it('reports itself disabled and serves nothing under the global shutdown', () => {
    const catalog = toPublicAiModelCatalog(new Set(), true);

    expect(catalog.availability).toBe('disabled');
    expect(catalog.models).toEqual([]);
    expect(catalog.defaultModelId).toBeNull();
  });

  it('reports no default when the default itself was disabled, and never re-points it', () => {
    const catalog = toPublicAiModelCatalog(new Set([AI_DEFAULT_MODEL_ID]), false);

    // A different model must never be silently promoted: the caller has to choose explicitly.
    expect(catalog.defaultModelId).toBeNull();
    expect(catalog.models.map((model) => model.id)).not.toContain(AI_DEFAULT_MODEL_ID);
  });
});

describe('resolveDisabledAiModelIds', () => {
  afterEach(() => vi.restoreAllMocks());

  it('serves every model when the kill switch is unset or empty', () => {
    expect(resolveDisabledAiModelIds({}).size).toBe(0);
    expect(resolveDisabledAiModelIds({ AI_DISABLED_MODELS: '  ' }).size).toBe(0);
  });

  it('parses a comma-separated list and tolerates whitespace', () => {
    const disabled = resolveDisabledAiModelIds({ AI_DISABLED_MODELS: ' ukisai-swift-max , ' });

    expect(disabled).toEqual(new Set(['ukisai-swift-max']));
  });

  it('disables the default model too, so an incident can stop the one every path falls back to', () => {
    const disabled = resolveDisabledAiModelIds({ AI_DISABLED_MODELS: AI_DEFAULT_MODEL_ID });

    expect(disabled).toEqual(new Set([AI_DEFAULT_MODEL_ID]));
  });

  it('ignores an unknown id in the switch instead of failing chat', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const disabled = resolveDisabledAiModelIds({ AI_DISABLED_MODELS: 'not-a-model' });

    expect(disabled.size).toBe(0);
    expect(warn).toHaveBeenCalledWith('AI_DISABLED_MODELS names an unknown model', {
      id: 'not-a-model',
    });
  });
});

describe('isAiModelServed', () => {
  it('serves a registered model with no kill switch and no retirement flag', () => {
    const max = AI_MODEL_ROUTES.find((route) => route.id === 'ukisai-swift-max');
    expect(max).toBeDefined();
    expect(isAiModelServed(max!, new Set(), false)).toBe(true);
  });

  it('stops serving a model the kill switch names', () => {
    const max = AI_MODEL_ROUTES.find((route) => route.id === 'ukisai-swift-max')!;
    expect(isAiModelServed(max, new Set(['ukisai-swift-max']), false)).toBe(false);
  });

  it('stops serving every model under the global shutdown, including the default', () => {
    for (const route of AI_MODEL_ROUTES) {
      expect(isAiModelServed(route, new Set(), true), route.id).toBe(false);
    }
    expect(listServedAiModelRoutes(new Set(), true)).toEqual([]);
  });

  it('lets the kill switch disable the default, which then has nothing to fall back to', () => {
    const standard = AI_MODEL_ROUTES.find((route) => route.isDefault)!;
    expect(isAiModelServed(standard, new Set([standard.id]), false)).toBe(false);
    expect(listServedAiModelRoutes(new Set([standard.id]), false)).not.toContain(standard);
  });
});

describe('isAiChatDisabled', () => {
  it('accepts the spellings someone would type during an incident', () => {
    for (const raw of ['true', 'TRUE', ' 1 ', 'yes', 'on', 'On']) {
      expect(isAiChatDisabled({ AI_CHAT_DISABLED: raw }), raw).toBe(true);
    }
  });

  it('treats unset, empty, and explicit-false values as enabled', () => {
    expect(isAiChatDisabled({})).toBe(false);
    expect(isAiChatDisabled({ AI_CHAT_DISABLED: '' })).toBe(false);
    expect(isAiChatDisabled({ AI_CHAT_DISABLED: 'false' })).toBe(false);
    // Not a spelling we claim to honor: a typo must not silently disable the assistant.
    expect(isAiChatDisabled({ AI_CHAT_DISABLED: 'disable' })).toBe(false);
  });
});
