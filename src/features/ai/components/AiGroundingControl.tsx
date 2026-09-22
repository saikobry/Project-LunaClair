import * as stylex from '@stylexjs/stylex';
import { SegmentedControl, SegmentedControlItem } from '../../../shared/ui/SegmentedControl/SegmentedControl';
import type { AiGroundingMode } from '../../../domain/ai/models/ai.types';
import { resolveGroundingNotice } from '../utils/aiGroundingNotice';

const styles = stylex.create({
  row: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    padding: '4px 16px 6px',
    backgroundColor: 'var(--color-background-surface)',
  },
  /**
   * Same treatment as the model picker's notice (`AiModelPicker`): a quiet secondary line that
   * describes the option currently selected, so the choice explains itself.
   */
  notice: {
    fontSize: 11,
    lineHeight: 1.35,
    color: 'var(--color-text-secondary)',
  },
});

export interface AiGroundingControlProps {
  materialId?: string;
  grounding: AiGroundingMode;
  onSetGrounding: (mode: AiGroundingMode) => void;
}

/**
 * Thread-scoped material document grounding toggle.
 *
 * Edits the active thread (or draft) only. The new-conversation default lives
 * in Settings (`AiSettingsSection`) — deliberately not here, so a per-thread
 * choice cannot silently become a global one.
 *
 * Each mode carries a one-line description of what it does to the next message, resolved from the
 * current value rather than shown as static help — the control states its own meaning.
 *
 * Only rendered when materialId is present (material-scoped workspace).
 */
export function AiGroundingControl({
  materialId,
  grounding,
  onSetGrounding,
}: AiGroundingControlProps) {
  if (materialId === undefined) return null;

  return (
    <div {...stylex.props(styles.row)}>
      <SegmentedControl
        label="Material context for this conversation"
        value={grounding}
        onChange={(val) => onSetGrounding(val as AiGroundingMode)}
        size="sm"
        layout="fill"
      >
        <SegmentedControlItem value="whole" label="Whole material" />
        <SegmentedControlItem value="none" label="No material" />
      </SegmentedControl>
      <span {...stylex.props(styles.notice)}>{resolveGroundingNotice(grounding)}</span>
    </div>
  );
}
