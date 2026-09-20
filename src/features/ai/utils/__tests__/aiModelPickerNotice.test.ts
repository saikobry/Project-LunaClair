import { describe, expect, it } from 'vitest';
import {
  resolvePickerNotice,
  resolvePickerUnavailableNotice,
} from '../aiModelPickerNotice';
import { AI_RATE_LIMIT_FALLBACK_SECONDS } from '../aiRateLimit';

const MODEL = { display: { name: 'MAX', tagline: 'Larger context window' } };

const base = {
  cooldownSeconds: 0,
  isOverBudget: false,
  selectedModelId: 'ukisai-swift-max',
  selectedModel: MODEL,
};

describe('resolvePickerUnavailableNotice', () => {
  it('names the switched-off assistant, which no user action can fix', () => {
    expect(resolvePickerUnavailableNotice(true, false)).toContain('temporarily unavailable');
  });

  it('names the empty catalog even when the assistant is otherwise on', () => {
    expect(resolvePickerUnavailableNotice(false, false)).toContain('No AI models');
  });

  it('says nothing when there is a choice to show', () => {
    expect(resolvePickerUnavailableNotice(false, true)).toBeNull();
  });
});

describe('resolvePickerNotice', () => {
  it('describes the selected model without warning about it', () => {
    expect(resolvePickerNotice(base)).toEqual({
      message: 'Larger context window',
      isWarning: false,
    });
  });

  it('says nothing when the selected model has no tagline', () => {
    expect(resolvePickerNotice({ ...base, selectedModel: { display: { name: 'MAX' } } })).toBeNull();
  });

  it('asks for a choice when the catalog has no default to inherit', () => {
    // Nothing is selected and nothing may be substituted, so the row has to request a choice.
    expect(resolvePickerNotice({ ...base, selectedModelId: null, selectedModel: undefined })).toEqual(
      { message: 'Choose a model to start chatting.', isWarning: true },
    );
  });

  it('names the model that does not fit the conversation', () => {
    const notice = resolvePickerNotice({ ...base, isOverBudget: true });

    expect(notice?.message).toContain('MAX');
    expect(notice?.isWarning).toBe(true);
  });

  it('falls back to a generic name when the selected model is not in the catalog', () => {
    const notice = resolvePickerNotice({
      ...base,
      isOverBudget: true,
      selectedModel: undefined,
    });

    expect(notice?.message).toContain('the selected model');
  });

  it('lets the cooldown outrank an overshoot, because waiting is the immediate constraint', () => {
    const notice = resolvePickerNotice({
      ...base,
      isOverBudget: true,
      cooldownSeconds: AI_RATE_LIMIT_FALLBACK_SECONDS,
    });

    expect(notice?.message).toContain('try again in');
    expect(notice?.isWarning).toBe(true);
  });
});
