import { memo } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { AiMessageRecord } from '../../../domain/ai/models/ai.types';
import { formatAiUsage } from '../utils/formatAiUsage';

const styles = stylex.create({
  usageLine: {
    marginTop: 6,
    fontSize: 11,
    color: 'var(--color-text-secondary)',
    fontVariantNumeric: 'tabular-nums',
  },
});

export interface AiMessageUsageProps {
  message: AiMessageRecord;
}

/**
 * Provider-reported token usage and estimated cost for one settled assistant turn.
 *
 * Renders nothing unless the turn is complete: an in-flight projection has no telemetry yet, and an
 * errored turn reports its failure instead of a cost. When the serving model has no published rate
 * the token count still renders and the cost is simply absent — unknown is not the same as free.
 */
export const AiMessageUsage = memo(function AiMessageUsage({ message }: AiMessageUsageProps) {
  const usage =
    message.role === 'assistant' && message.status === 'complete'
      ? formatAiUsage(message.metadata?.usage, message.metadata?.model)
      : null;

  if (!usage) return null;

  return (
    <div
      {...stylex.props(styles.usageLine)}
      data-testid={`ai-usage-${message.id}`}
      // The prompt/completion split stays on hover rather than being spent as transcript space.
      title={usage.breakdown ?? undefined}
    >
      {usage.label}
    </div>
  );
});
