import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AiModelPicker } from '../AiModelPicker';
import { DEFAULT_AI_MODEL_CATALOG } from '../../../../domain/ai/services/aiModelCatalog';

const MODELS = DEFAULT_AI_MODEL_CATALOG.models;
const DEFAULT_ID = DEFAULT_AI_MODEL_CATALOG.defaultModelId;
const MAX_ID = 'ukisai-swift-max';

function renderPicker(overrides: Partial<React.ComponentProps<typeof AiModelPicker>> = {}) {
  const onSelectModel = vi.fn();
  render(
    <AiModelPicker
      models={MODELS}
      selectedModelId={DEFAULT_ID}
      onSelectModel={onSelectModel}
      isOverBudget={false}
      cooldownSeconds={0}
      {...overrides}
    />,
  );
  return { onSelectModel };
}

describe('AiModelPicker', () => {
  it('offers every catalog model by its display name', () => {
    renderPicker();

    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('MAX')).toBeInTheDocument();
  });

  it('reports the chosen model by catalog id', () => {
    const { onSelectModel } = renderPicker();

    fireEvent.click(screen.getByText('MAX'));

    expect(onSelectModel).toHaveBeenCalledWith(MAX_ID);
  });

  it('describes the selected model when nothing is wrong', () => {
    renderPicker();

    expect(screen.getByText(/Fast, economical everyday assistant/)).toBeInTheDocument();
  });

  it('says the conversation no longer fits, and what to do about it', () => {
    renderPicker({ isOverBudget: true });

    const notice = screen.getByText(/no longer fits Standard/);
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toMatch(/Start a new chat or pick another model/);
  });

  it('says when shared capacity is busy, with the wait', () => {
    renderPicker({ cooldownSeconds: 7 });

    expect(screen.getByText(/try again in 7s/i)).toBeInTheDocument();
  });

  it('prefers the cooldown message when a rate limit is also over budget', () => {
    // The immediate cause is the refusal; the budget is a fact about the conversation, not why the
    // last request failed.
    renderPicker({ isOverBudget: true, cooldownSeconds: 4 });

    expect(screen.getByText(/try again in 4s/i)).toBeInTheDocument();
    expect(screen.queryByText(/no longer fits/)).not.toBeInTheDocument();
  });

  it('renders nothing when the catalog offers no choice', () => {
    // A single-option control implies a capability that is not there.
    renderPicker({ models: [MODELS[0]] });

    expect(screen.queryByText('Standard')).not.toBeInTheDocument();
    expect(screen.queryByText('MAX')).not.toBeInTheDocument();
  });
});
