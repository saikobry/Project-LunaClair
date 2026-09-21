import * as stylex from '@stylexjs/stylex';
import { SegmentedControl, SegmentedControlItem } from '../../../shared/ui/SegmentedControl/SegmentedControl';
import type { AiSelectionThreadMode } from '../../../domain/ai/models/ai.types';

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '4px 16px 6px',
    backgroundColor: 'var(--color-background-surface)',
  },
  hint: {
    fontSize: 11,
    lineHeight: 1.35,
    textAlign: 'right',
    color: 'var(--color-text-secondary)',
    maxWidth: 220,
  },
});

export interface AiSelectionThreadModeControlProps {
  threadMode: AiSelectionThreadMode;
  onSetThreadMode: (mode: AiSelectionThreadMode) => void;
}

/**
 * Where a reader selection action (Explain / Simplify / Example) sends its turn.
 *
 * `'latest'` continues the material's newest conversation (creating one when
 * none exists); `'new'` always opens a distinct conversation. A dumb control
 * on purpose — the preference value and its persistence live in
 * `useAiSelectionThreadMode`, so the drawer and the settings surface cannot
 * disagree about what is selected.
 */
export function AiSelectionThreadModeControl({
  threadMode,
  onSetThreadMode,
}: AiSelectionThreadModeControlProps) {
  return (
    <div {...stylex.props(styles.row)}>
      <SegmentedControl
        label="Where selection actions reply"
        value={threadMode}
        onChange={(value) => onSetThreadMode(value as AiSelectionThreadMode)}
        size="sm"
      >
        <SegmentedControlItem value="latest" label="Latest chat" />
        <SegmentedControlItem value="new" label="New chat" />
      </SegmentedControl>
      <span {...stylex.props(styles.hint)}>
        {threadMode === 'latest'
          ? 'Explain, Simplify and Example reply inside the newest conversation.'
          : 'Each selection action opens its own conversation.'}
      </span>
    </div>
  );
}
