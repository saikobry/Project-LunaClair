import { describe, expect, it } from 'vitest';
import {
  AI_CATALOG_VERSION,
  AI_DEFAULT_MODEL_ID,
  DEFAULT_AI_MODEL_CATALOG,
  findAiModelDescriptor,
  getAiModelDescriptor,
  isAiCatalogVersion,
  isAiModelCatalog,
  compareAiCatalogVersions,
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

  it('ranks by numeric fields, not by text', () => {
    // As text, `2026-9-2.1` sorts *after* `2026-10-01.1`; as numbers it is September, so it loses.
    expect(
      pickNewerAiModelCatalog(
        { ...DEFAULT_AI_MODEL_CATALOG, version: '2026-9-2.1' },
        { ...DEFAULT_AI_MODEL_CATALOG, version: '2026-10-01.1' },
      )?.version,
    ).toBe('2026-10-01.1');
  });

  it('never lets a malformed version displace a well-formed one', () => {
    const malformed: AiModelCatalog = { ...DEFAULT_AI_MODEL_CATALOG, version: 'zzz' };
    const wellFormed: AiModelCatalog = { ...DEFAULT_AI_MODEL_CATALOG, version: '2026-01-01.1' };

    expect(pickNewerAiModelCatalog(malformed, wellFormed)?.version).toBe(wellFormed.version);
    expect(pickNewerAiModelCatalog(wellFormed, malformed)?.version).toBe(wellFormed.version);
  });
});

describe('compareAiCatalogVersions', () => {
  it('compares each field numerically', () => {
    expect(compareAiCatalogVersions('2026-09-20.1', '2026-09-20.1')).toBe(0);
    expect(compareAiCatalogVersions('2026-09-20.1', '2026-09-20.2')).toBeLessThan(0);
    expect(compareAiCatalogVersions('2026-09-21.0', '2026-09-20.9')).toBeGreaterThan(0);
    expect(compareAiCatalogVersions('2027-01-01.0', '2026-12-31.9')).toBeGreaterThan(0);
  });

  it('orders a well-formed label above an unparseable one, either way round', () => {
    expect(compareAiCatalogVersions('2026-09-20.1', 'not-a-version')).toBeGreaterThan(0);
    expect(compareAiCatalogVersions('not-a-version', '2026-09-20.1')).toBeLessThan(0);
  });

  it('stays deterministic when neither label is parseable', () => {
    expect(compareAiCatalogVersions('bbb', 'aaa')).toBeGreaterThan(0);
    expect(compareAiCatalogVersions('aaa', 'bbb')).toBeLessThan(0);
    expect(compareAiCatalogVersions('aaa', 'aaa')).toBe(0);
  });
});

describe('isAiCatalogVersion', () => {
  it('accepts the format the registry and the mirror both use', () => {
    expect(isAiCatalogVersion(AI_CATALOG_VERSION)).toBe(true);
  });

  it('rejects labels the numeric comparison could not order', () => {
    for (const version of ['2026-09-20', '2026-9-20.1', 'v1', '', '2026-09-20.1-beta']) {
      expect(isAiCatalogVersion(version), version).toBe(false);
    }
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
