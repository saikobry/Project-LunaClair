import { memo, useMemo } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { AiMessageRecord } from '../../../domain/ai/models/ai.types';
import {
  summarizeSessionUsage,
  type SessionContextEstimate,
  type SessionUsageSummary,
} from '../utils/aiSessionMetrics';
import { formatTokenCount, formatUsdCost } from '../utils/formatAiUsage';

const styles = stylex.create({
  strip: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '6px 16px 8px',
    borderTop: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    fontVariantNumeric: 'tabular-nums',
  },
  // Keeps the context figure right-aligned when there are no session totals beside it.
  context: {
    marginLeft: 'auto',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'var(--color-background-muted)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.25s ease',
  },
  fillNormal: {
    backgroundColor: 'var(--color-accent)',
  },
  // Approaching the ceiling is a warning, not a failure — the request has not been rejected.
  fillOver: {
    backgroundColor: 'var(--color-warning)',
  },
});

function buildTotalsTitle(summary: SessionUsageSummary): string {
  const parts = [
    `${summary.meteredTurns} ${summary.meteredTurns === 1 ? 'reply' : 'replies'} measured`,
    `${formatTokenCount(summary.totalTokens)} tokens reported by the provider`,
  ];

  if (summary.unpricedTurns > 0) {
    parts.push(
      `${summary.unpricedTurns} served by a model with no published rate, so no total cost is shown`,
    );
  } else {
    parts.push(`total ${formatUsdCost(summary.totalCostUsd)}`);
  }

  return parts.join(' · ');
}

function buildContextTitle(context: SessionContextEstimate): string {
  const { estimate } = context;
  const parts = [
    `Next reply: about ${formatTokenCount(estimate.estimatedPromptTokens)} of ${formatTokenCount(estimate.promptBudgetTokens)} prompt tokens available (${formatTokenCount(estimate.windowTokens)} token window)`,
    `estimated from ${formatTokenCount(context.documentChars + context.selectionChars + context.conversationChars)} characters, so approximate`,
  ];

  if (context.lastMeasuredPromptTokens !== null) {
    parts.push(`the last request actually used ${formatTokenCount(context.lastMeasuredPromptTokens)}`);
  }

  return parts.join(' · ');
}

export interface AiSessionMetricsProps {
  /** Settled turns whose reported usage the totals are summed from. */
  messages: AiMessageRecord[];
  /**
   * The next request's context estimate, computed by the caller.
   *
   * Passed in rather than derived here so the meter and the drawer's send guard read the **same**
   * number from one calculation: two call sites of `estimateSessionContext` would walk the
   * transcript and the document twice per change and, worse, each have to be updated whenever the
   * estimator does.
   */
  context: SessionContextEstimate;
}

/**
 * Conversation-level cost and context readout, shown above the composer.
 *
 * Two different kinds of number, deliberately kept distinct: the session totals are **measured**
 * (summed from the provider's own reports on settled turns), while the context figure is an
 * **estimate** of the next request derived from character counts. The tooltips say which is which —
 * a meter that hides the difference invites trusting it more than it deserves.
 */
export const AiSessionMetrics = memo(function AiSessionMetrics({
  messages,
  context,
}: AiSessionMetricsProps) {
  const totals = useMemo(() => summarizeSessionUsage(messages), [messages]);

  // Nothing measured and nothing to ground means nothing worth the chrome. The estimate already
  // holds the capped character counts, so it answers this without re-deriving anything.
  const metersAnything =
    context.documentChars + context.selectionChars + context.conversationChars > 0;
  if (!metersAnything) return null;

  const totalsLabel = totals
    ? `Session ${totals.tokenLabel} tokens${totals.costLabel ? ` · ${totals.costLabel}` : ''}`
    : null;
  const percent = context.percent;

  return (
    <div {...stylex.props(styles.strip)} data-testid="ai-session-metrics">
      <div {...stylex.props(styles.row)}>
        {totalsLabel && totals && <span title={buildTotalsTitle(totals)}>{totalsLabel}</span>}
        <span {...stylex.props(styles.context)} title={buildContextTitle(context)}>
          Context ~{percent}%
        </span>
      </div>
      <div
        {...stylex.props(styles.track)}
        role="progressbar"
        aria-valuenow={Math.min(100, Math.max(0, percent))}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Estimated context window usage"
      >
        <div
          {...stylex.props(
            styles.fill,
            context.estimate.isOverBudget ? styles.fillOver : styles.fillNormal,
          )}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
});
