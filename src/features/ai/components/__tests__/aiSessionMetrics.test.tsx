import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiSessionMetrics } from '../AiSessionMetrics';
import type { AiMessageRecord } from '../../../../domain/ai/models/ai.types';
import { estimateSessionContext } from '../../utils/aiSessionMetrics';

const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

function userTurn(id: string, content = 'What is the sinoatrial node?'): AiMessageRecord {
  return {
    id,
    threadId: 'th-1',
    role: 'user',
    content,
    status: 'complete',
    createdAt: '2026-09-19T00:00:00.000Z',
  };
}

function meteredTurn(
  id: string,
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
  model = PRIMARY_MODEL,
): AiMessageRecord {
  return {
    id,
    threadId: 'th-1',
    role: 'assistant',
    content: 'It is the natural pacemaker of the heart.',
    status: 'complete',
    createdAt: '2026-09-19T00:00:01.000Z',
    metadata: { usage, model },
  };
}

/**
 * Renders the strip the way the drawer does — the estimate computed by the caller and passed in.
 * The drawer and this component share one calculation, so the test must not invent its own.
 */
function renderMetrics(
  messages: AiMessageRecord[],
  options: { documentMarkdown?: string; selectionText?: string; modelId?: string } = {},
) {
  return render(
    <AiSessionMetrics
      messages={messages}
      context={estimateSessionContext({ messages, ...options })}
    />,
  );
}

describe('AiSessionMetrics', () => {
  it('shows the conversation total and the estimated context share', () => {
    renderMetrics([
      userTurn('u1'),
      meteredTurn('a1', { promptTokens: 4820, completionTokens: 312, totalTokens: 5132 }),
    ]);

    const strip = screen.getByTestId('ai-session-metrics');
    expect(strip).toHaveTextContent('Session 5,132 tokens · $0.0021');
    expect(strip).toHaveTextContent('Context ~1%');
  });

  it('renders nothing when there is no conversation and no material to ground it', () => {
    renderMetrics([]);

    expect(screen.queryByTestId('ai-session-metrics')).toBeNull();
  });

  it('shows the context estimate on a fresh conversation that has a material', () => {
    renderMetrics([], { documentMarkdown: '# Cells\n\nMitosis and meiosis.' });

    const strip = screen.getByTestId('ai-session-metrics');
    // No measured turns yet, so there is no session total to state.
    expect(strip).not.toHaveTextContent('Session');
    expect(strip).toHaveTextContent('Context ~1%');
  });

  it('states no cost when a turn was served by a model with no published rate', () => {
    renderMetrics([meteredTurn('a1', { promptTokens: 100, completionTokens: 50, totalTokens: 150 }, 'unpriced-model')]);

    const strip = screen.getByTestId('ai-session-metrics');
    expect(strip).toHaveTextContent('Session 150 tokens');
    expect(strip).not.toHaveTextContent('$');
  });

  it('flags an over-budget conversation while the bar stays within its track', () => {
    renderMetrics(Array.from({ length: 30 }, (_, index) => userTurn(`u${index}`, 'x'.repeat(3_000))));

    const bar = screen.getByRole('progressbar', { name: /estimated context window usage/i });
    // ARIA stays inside its declared range even though the true figure exceeds the budget.
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    // The visible figure reports the real overshoot rather than clamping it.
    expect(screen.getByTestId('ai-session-metrics')).toHaveTextContent(/Context ~1\d\d%/);
  });

  it('exposes the split and the last measured prompt on hover', () => {
    renderMetrics([meteredTurn('a1', { promptTokens: 4820, completionTokens: 312, totalTokens: 5132 })]);

    const context = screen.getByText(/Context ~/);
    expect(context.getAttribute('title')).toMatch(/the last request actually used 4,820/);
    expect(context.getAttribute('title')).toMatch(/approximate/);
    expect(screen.getByText(/Session /).getAttribute('title')).toMatch(
      /1 reply measured · 5,132 tokens reported by the provider/,
    );
  });

  it('meters against the selected model rather than the default one', () => {
    // MAX accepts ~10x the material, so the same document is a fraction of its window.
    const document = 'x'.repeat(80_000);

    renderMetrics([], { documentMarkdown: document, modelId: 'ukisai-swift-max' });

    // 262,144 window − 4,096 reserved output, formatted by the shared compact rule.
    const maxTitle = screen.getByText(/Context ~/).getAttribute('title') ?? '';
    expect(maxTitle).toMatch(/of 258\.0k prompt tokens available/);
  });
});
