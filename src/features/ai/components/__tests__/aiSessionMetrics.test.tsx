import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiSessionMetrics } from '../AiSessionMetrics';
import type { AiMessageRecord } from '../../../../domain/ai/models/ai.types';

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

describe('AiSessionMetrics', () => {
  it('shows the conversation total and the estimated context share', () => {
    render(
      <AiSessionMetrics
        messages={[
          userTurn('u1'),
          meteredTurn('a1', { promptTokens: 4820, completionTokens: 312, totalTokens: 5132 }),
        ]}
      />,
    );

    const strip = screen.getByTestId('ai-session-metrics');
    expect(strip).toHaveTextContent('Session 5,132 tokens · $0.0021');
    expect(strip).toHaveTextContent('Context ~1%');
  });

  it('renders nothing when there is no conversation and no material to ground it', () => {
    render(<AiSessionMetrics messages={[]} />);

    expect(screen.queryByTestId('ai-session-metrics')).toBeNull();
  });

  it('shows the context estimate on a fresh conversation that has a material', () => {
    render(<AiSessionMetrics messages={[]} documentMarkdown="# Cells\n\nMitosis and meiosis." />);

    const strip = screen.getByTestId('ai-session-metrics');
    // No measured turns yet, so there is no session total to state.
    expect(strip).not.toHaveTextContent('Session');
    expect(strip).toHaveTextContent('Context ~1%');
  });

  it('states no cost when a turn was served by a model with no published rate', () => {
    render(
      <AiSessionMetrics
        messages={[meteredTurn('a1', { promptTokens: 100, completionTokens: 50, totalTokens: 150 }, 'unpriced-model')]}
      />,
    );

    const strip = screen.getByTestId('ai-session-metrics');
    expect(strip).toHaveTextContent('Session 150 tokens');
    expect(strip).not.toHaveTextContent('$');
  });

  it('flags an over-budget conversation while the bar stays within its track', () => {
    render(
      <AiSessionMetrics
        messages={Array.from({ length: 30 }, (_, index) => userTurn(`u${index}`, 'x'.repeat(3_000)))}
      />,
    );

    const bar = screen.getByRole('progressbar', { name: /estimated context window usage/i });
    // ARIA stays inside its declared range even though the true figure exceeds the budget.
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    // The visible figure reports the real overshoot rather than clamping it.
    expect(screen.getByTestId('ai-session-metrics')).toHaveTextContent(/Context ~1\d\d%/);
  });

  it('exposes the split and the last measured prompt on hover', () => {
    render(
      <AiSessionMetrics
        messages={[meteredTurn('a1', { promptTokens: 4820, completionTokens: 312, totalTokens: 5132 })]}
      />,
    );

    const context = screen.getByText(/Context ~/);
    expect(context.getAttribute('title')).toMatch(/the last request actually used 4,820/);
    expect(context.getAttribute('title')).toMatch(/approximate/);
    expect(screen.getByText(/Session /).getAttribute('title')).toMatch(
      /1 reply measured · 5,132 tokens reported by the provider/,
    );
  });
});
