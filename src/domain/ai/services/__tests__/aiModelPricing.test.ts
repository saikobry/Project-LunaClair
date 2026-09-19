import { describe, expect, it } from 'vitest';
import { estimateAiCostUsd } from '../aiModelPricing';
import {
  DEFAULT_AI_MODEL_CATALOG,
  findAiModelDescriptor,
} from '../aiModelCatalog';

const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const PRIMARY_CATALOG_ID = 'cf-llama-3.3-70b';

describe('estimateAiCostUsd', () => {
  it('prices the input and output halves at their own rates', () => {
    // 1M input at $0.293 + 1M output at $2.253 — the two rates are the whole point of the split.
    const cost = estimateAiCostUsd({ promptTokens: 1_000_000, completionTokens: 1_000_000 }, PRIMARY_MODEL);

    expect(cost).toBeCloseTo(0.293 + 2.253, 10);
  });

  it('prices a realistic turn', () => {
    // 4,820 prompt tokens at $0.293/M + 312 completion tokens at $2.253/M, to the cent-micro.
    const cost = estimateAiCostUsd({ promptTokens: 4820, completionTokens: 312 }, PRIMARY_MODEL);

    expect(cost).toBeCloseTo(0.002115196, 9);
  });

  it('weights output far above input, matching the published rates', () => {
    const inputHeavy = estimateAiCostUsd({ promptTokens: 1000, completionTokens: 0 }, PRIMARY_MODEL);
    const outputHeavy = estimateAiCostUsd({ promptTokens: 0, completionTokens: 1000 }, PRIMARY_MODEL);

    expect(outputHeavy).toBeGreaterThan(inputHeavy!);
  });

  it('returns null when the model is unknown', () => {
    // Unknown beats a wrong number: an unregistered model is unpriced by design.
    expect(estimateAiCostUsd({ promptTokens: 100, completionTokens: 50 }, 'some-other-model')).toBeNull();
  });

  it('prices a turn by catalog id as well as by the provider id older turns recorded', () => {
    const usage = { promptTokens: 1_000, completionTokens: 100 };

    expect(estimateAiCostUsd(usage, PRIMARY_CATALOG_ID)).toBe(
      estimateAiCostUsd(usage, PRIMARY_MODEL),
    );
  });

  it('returns null for a free model rather than charging zero', () => {
    expect(
      estimateAiCostUsd({ promptTokens: 1_000, completionTokens: 100 }, 'ukisai-swift-max'),
    ).toBeNull();
  });

  it('returns null without a model, since the rate cannot be chosen', () => {
    expect(estimateAiCostUsd({ promptTokens: 100, completionTokens: 50 })).toBeNull();
  });

  it('returns null without usage', () => {
    expect(estimateAiCostUsd(undefined, PRIMARY_MODEL)).toBeNull();
    expect(estimateAiCostUsd(null, PRIMARY_MODEL)).toBeNull();
  });

  it('returns null when a total is reported without the input/output split', () => {
    // One number cannot be split across two rates without inventing the proportion.
    expect(estimateAiCostUsd({ totalTokens: 5000 }, PRIMARY_MODEL)).toBeNull();
  });

  it('costs a zero-token turn as zero rather than unknown', () => {
    expect(estimateAiCostUsd({ promptTokens: 0, completionTokens: 0 }, PRIMARY_MODEL)).toBe(0);
  });
});

describe('catalog rates', () => {
  it('prices every priced model with positive rates', () => {
    for (const model of DEFAULT_AI_MODEL_CATALOG.models) {
      if (!model.pricing) continue;
      expect(model.pricing.inputPerMillionUsd, model.id).toBeGreaterThan(0);
      expect(model.pricing.outputPerMillionUsd, model.id).toBeGreaterThan(0);
    }
  });

  it('records the default model as priced and a provider id back to its descriptor', () => {
    expect(findAiModelDescriptor(DEFAULT_AI_MODEL_CATALOG, PRIMARY_MODEL)?.pricing).not.toBeNull();
  });
});
