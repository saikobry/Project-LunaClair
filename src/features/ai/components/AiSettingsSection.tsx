import { useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Card } from '../../../shared/ui/Card/Card';
import { SegmentedControl, SegmentedControlItem } from '../../../shared/ui/SegmentedControl/SegmentedControl';
import type { AiGroundingMode } from '../../../domain/ai/models/ai.types';
import { useAiModelSelection } from '../hooks/useAiModelSelection';
import { useAiGroundingDefault } from '../hooks/queries/useAiGroundingDefault';
import { useAiSelectionThreadMode } from '../hooks/queries/useAiSelectionThreadMode';
import { AiModelPicker } from './AiModelPicker';
import { AiSelectionThreadModeControl } from './AiSelectionThreadModeControl';

const styles = stylex.create({
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width: '100%',
  },
  heading: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  description: {
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--color-text-secondary)',
    margin: '4px 0 12px 0',
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '16px 20px',
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  rowHint: {
    fontSize: 12,
    lineHeight: 1.45,
    color: 'var(--color-text-secondary)',
  },
  divider: {
    height: 1,
    backgroundColor: 'var(--color-border)',
    margin: '0 20px',
  },
});

/**
 * The AI section of the Settings screen — every assistant preference in one place.
 *
 * Single ownership matters here: the model catalog, the grounding default, and
 * the selection thread mode are all AI-bounded state, so the section lives in
 * the ai feature and the settings screen only composes it. The pickers and
 * controls are the same units the drawer uses, reading the same shared cache
 * entries, so changing a preference here is immediately true everywhere.
 */
export function AiSettingsSection() {
  const modelSelection = useAiModelSelection();
  const { defaultMode, setDefaultMode } = useAiGroundingDefault();
  const { threadMode, setThreadMode } = useAiSelectionThreadMode();

  const handleSetGroundingDefault = useCallback(
    (mode: AiGroundingMode) => {
      void setDefaultMode(mode);
    },
    [setDefaultMode],
  );

  const handleSetThreadMode = useCallback(
    (mode: Parameters<typeof setThreadMode>[0]) => {
      void setThreadMode(mode);
    },
    [setThreadMode],
  );

  return (
    <section {...stylex.props(styles.section)} aria-labelledby="settings-ai-heading">
      <h2 {...stylex.props(styles.heading)} id="settings-ai-heading">
        AI Study Assistant
      </h2>
      <p {...stylex.props(styles.description)}>
        Model choice, material inclusion, and where selection actions reply. These
        preferences are device-local and never leave this browser.
      </p>
      <Card>
        <div {...stylex.props(styles.row)}>
          <span {...stylex.props(styles.rowLabel)}>Preferred model</span>
          <span {...stylex.props(styles.rowHint)}>
            Used for chat and selection actions. Generators start from it, and each batch can pick its
            own.
          </span>
          <AiModelPicker
            models={modelSelection.catalog.models}
            defaultModelId={modelSelection.catalog.defaultModelId}
            isAiDisabled={modelSelection.isAiDisabled}
            selectedModelId={modelSelection.selectedModel?.id ?? null}
            onSelectModel={modelSelection.selectModel}
            isOverBudget={false}
            cooldownSeconds={0}
            layout="stacked"
          />
        </div>
        <div {...stylex.props(styles.divider)} aria-hidden="true" />
        <div {...stylex.props(styles.row)}>
          <span {...stylex.props(styles.rowLabel)}>Include material by default</span>
          <span {...stylex.props(styles.rowHint)}>
            New conversations start grounded in the whole material, or ungrounded.
          </span>
          <SegmentedControl
            label="Material inclusion for new conversations"
            value={defaultMode}
            onChange={(value) => handleSetGroundingDefault(value as AiGroundingMode)}
            size="sm"
          >
            <SegmentedControlItem value="whole" label="Whole material" />
            <SegmentedControlItem value="none" label="No material" />
          </SegmentedControl>
        </div>
        <div {...stylex.props(styles.divider)} aria-hidden="true" />
        <div {...stylex.props(styles.row)}>
          <span {...stylex.props(styles.rowLabel)}>Selection replies</span>
          <span {...stylex.props(styles.rowHint)}>
            Where Explain, Simplify, and Example send their turn.
          </span>
          <AiSelectionThreadModeControl
            threadMode={threadMode}
            onSetThreadMode={handleSetThreadMode}
            layout="stacked"
          />
        </div>
      </Card>
    </section>
  );
}
