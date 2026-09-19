import { describe, expect, it } from 'vitest';
import {
  AI_CATALOG_VERSION,
  AI_DEFAULT_MODEL_ID,
  DEFAULT_AI_MODEL_CATALOG,
  findAiModelDescriptor,
  getAiModelDescriptor,
  isAiModelCatalog,
  pickNewerAiModelCatalog,
  type AiModelCatalog,
} from '../aiModelCatalog';

const PRIMARY_PROVIDER_ID = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

describe('DEFAULT_AI_MODEL_CATALOG', () => {
  it('points its defaultModelId at a model it actually contains', () => {
    expect(findAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, AI_DEFAULT_MODEL_ID)).toBeDefined();
  });

  it('holds one descriptor per catalog id', () => {
    const ids = DEFAULT_AI_MODEL_CATALOG.models.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every model a positive window, output reservation, and document budget', () => {
    for (const model of DEFAULT_AI_MODEL_CATALOG.models) {
      expect(model.contextWindowTokens, model.id).toBeGreaterThan(0);
      expect(model.maxOutputTokens, model.id).toBeGreaterThan(0);
      expect(model.maxOutputTokens, model.id).toBeLessThan(model.contextWindowTokens);
      expect(model.maxDocumentContextChars, model.id).toBeGreaterThan(0);
    }
  });

  it('offers the MAX model a larger window and document budget than the default', () => {
    const standard = getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, AI_DEFAULT_MODEL_ID);
    const max = getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, 'ukisai-swift-max');

    expect(max.display.name).toBe('MAX');
    expect(max.contextWindowTokens).toBeGreaterThan(standard.contextWindowTokens);
    expect(max.maxDocumentContextChars).toBeGreaterThan(standard.maxDocumentContextChars);
  });
});

describe('findAiModelDescriptor', () => {
  it('resolves a descriptor by catalog id', () => {
    expect(findAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, AI_DEFAULT_MODEL_ID)?.id).toBe(
      AI_DEFAULT_MODEL_ID,
    );
  });

  it('resolves a turn persisted by an older build that recorded the provider model id', () => {
    // Historical rows carry the provider's own id; dropping that lookup would make them unpriced.
    expect(findAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, PRIMARY_PROVIDER_ID)?.id).toBe(
      AI_DEFAULT_MODEL_ID,
    );
  });

  it('resolves an unknown or absent id to undefined', () => {
    expect(findAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, 'unknown-model')).toBeUndefined();
    expect(findAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, undefined)).toBeUndefined();
  });
});

describe('getAiModelDescriptor', () => {
  it('falls back to the catalog default for an unknown id', () => {
    expect(getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, 'unknown-model').id).toBe(
      DEFAULT_AI_MODEL_CATALOG.defaultModelId,
    );
  });

  it('falls back to the catalog default when no id is given', () => {
    expect(getAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG).id).toBe(
      DEFAULT_AI_MODEL_CATALOG.defaultModelId,
    );
  });
});

describe('pickNewerAiModelCatalog', () => {
  const older: AiModelCatalog = { ...DEFAULT_AI_MODEL_CATALOG, version: '2026-01-01.1' };
  const newer: AiModelCatalog = { ...DEFAULT_AI_MODEL_CATALOG, version: '2026-12-31.1' };

  it('prefers the higher version regardless of argument order', () => {
    expect(pickNewerAiModelCatalog(older, newer)?.version).toBe(newer.version);
    expect(pickNewerAiModelCatalog(newer, older)?.version).toBe(newer.version);
  });

  it('keeps one side when the other is missing', () => {
    expect(pickNewerAiModelCatalog(null, newer)?.version).toBe(newer.version);
    expect(pickNewerAiModelCatalog(older, null)?.version).toBe(older.version);
    expect(pickNewerAiModelCatalog(null, null)).toBeNull();
  });

  it('treats an equal version as the first argument, so a fetched copy wins a tie', () => {
    expect(pickNewerAiModelCatalog(newer, { ...newer })?.version).toBe(newer.version);
  });
});

describe('isAiModelCatalog', () => {
  it('accepts the bundled catalog', () => {
    expect(isAiModelCatalog(DEFAULT_AI_MODEL_CATALOG)).toBe(true);
  });

  it('rejects a payload missing required facts', () => {
    expect(isAiModelCatalog(null)).toBe(false);
    expect(isAiModelCatalog({ version: 'x', defaultModelId: 'y', models: [] })).toBe(false);
    expect(
      isAiModelCatalog({
        version: 'x',
        defaultModelId: 'y',
        models: [{ id: 'z', display: { name: 'Z' } }],
      }),
    ).toBe(false);
  });

  it('accepts a catalog whose version differs from the bundle', () => {
    expect(isAiModelCatalog({ ...DEFAULT_AI_MODEL_CATALOG, version: '2099-01-01.1' })).toBe(true);
    expect(AI_CATALOG_VERSION).toBe(DEFAULT_AI_MODEL_CATALOG.version);
  });
});
