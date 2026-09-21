import { useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { SegmentedControl, SegmentedControlItem } from '../../../shared/ui/SegmentedControl/SegmentedControl';
import type { AiGroundingMode } from '../../../domain/ai/models/ai.types';
import { useAiGroundingDefault } from '../hooks/queries/useAiGroundingDefault';

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '4px 16px 6px',
    backgroundColor: 'var(--color-background-surface)',
  },
  affordance: {
    fontSize: 11,
    lineHeight: 1.35,
    textAlign: 'right',
  },
  defaultButton: {
    background: 'none',
    border: 'none',
    padding: 0,
    margin: 0,
    fontSize: 11,
    lineHeight: 1.35,
    color: 'var(--color-accent)',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontFamily: 'inherit',
    ':hover': {
      color: 'var(--color-accent-hover)',
    },
  },
  defaultActiveText: {
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
 * Primary toggle and secondary default affordance for thread-scoped material document grounding.
 *
 * The primary control edits the active thread (or draft); the secondary affordance persists
 * the choice into preferences as the default for new conversations.
 * Only rendered when materialId is present (material-scoped workspace).
 */
export function AiGroundingControl({
  materialId,
  grounding,
  onSetGrounding,
}: AiGroundingControlProps) {
  const { defaultMode, setDefaultMode } = useAiGroundingDefault();

  const handleSaveDefault = useCallback(() => {
    void setDefaultMode(grounding);
  }, [grounding, setDefaultMode]);

  if (materialId === undefined) return null;

  const isCurrentDefault = grounding === defaultMode;

  return (
    <div {...stylex.props(styles.row)}>
      <SegmentedControl
        label="Material context for this conversation"
        value={grounding}
        onChange={(val) => onSetGrounding(val as AiGroundingMode)}
        size="sm"
      >
        <SegmentedControlItem value="whole" label="Whole material" />
        <SegmentedControlItem value="none" label="No material" />
      </SegmentedControl>
      <div {...stylex.props(styles.affordance)}>
        {isCurrentDefault ? (
          <span {...stylex.props(styles.defaultActiveText)} title="Current default for new conversations">
            (Default for new chats)
          </span>
        ) : (
          <button
            type="button"
            {...stylex.props(styles.defaultButton)}
            onClick={handleSaveDefault}
            aria-label={`Save ${grounding === 'whole' ? 'whole material' : 'no material'} as default for new conversations`}
          >
            Set as default for new chats
          </button>
        )}
      </div>
    </div>
  );
}
