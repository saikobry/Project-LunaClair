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
  rowStacked: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    padding: 0,
    backgroundColor: 'transparent',
  },
  hint: {
    fontSize: 11,
    lineHeight: 1.35,
    textAlign: 'right',
    color: 'var(--color-text-secondary)',
    maxWidth: 220,
  },
  hintStacked: {
    textAlign: 'left',
    maxWidth: 'none',
  },
});

export interface AiSelectionThreadModeControlProps {
  threadMode: AiSelectionThreadMode;
  onSetThreadMode: (mode: AiSelectionThreadMode) => void;
  /**
   * `'inline'` (default) is the drawer's horizontal strip — control beside its
   * hint. `'stacked'` is the Settings card row — control full-width with the
   * hint below it, no padding or surface of its own (the section row owns
   * the geometry, so inline insets would double up).
   */
  layout?: 'inline' | 'stacked';
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
  layout = 'inline',
}: AiSelectionThreadModeControlProps) {
  const stacked = layout === 'stacked';
  return (
    <div {...stylex.props(styles.row, stacked && styles.rowStacked)}>
      <SegmentedControl
        label="Where selection actions reply"
        value={threadMode}
        onChange={(value) => onSetThreadMode(value as AiSelectionThreadMode)}
        size="sm"
        layout="fill"
      >
        <SegmentedControlItem value="latest" label="Latest chat" />
        <SegmentedControlItem value="new" label="New chat" />
      </SegmentedControl>
      <span {...stylex.props(styles.hint, stacked && styles.hintStacked)}>
        {threadMode === 'latest'
          ? 'Explain, Simplify and Example reply inside the newest conversation.'
          : 'Each selection action opens its own conversation.'}
      </span>
    </div>
  );
}
