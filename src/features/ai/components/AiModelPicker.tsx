import * as stylex from '@stylexjs/stylex';
import { SegmentedControl, SegmentedControlItem } from '../../../shared/ui/SegmentedControl/SegmentedControl';
import type { AiModelDescriptor } from '../../../domain/ai/services/aiModelCatalog';
import {
  resolvePickerNotice,
  resolvePickerUnavailableNotice,
} from '../utils/aiModelPickerNotice';

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '6px 16px 8px',
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
  notice: {
    fontSize: 11,
    lineHeight: 1.35,
    textAlign: 'right',
    color: 'var(--color-text-secondary)',
  },
  noticeStacked: {
    textAlign: 'left',
  },
  noticeWarning: {
    color: 'var(--color-warning)',
  },
});

export interface AiModelPickerProps {
  /** Selectable models, in catalog order. */
  models: AiModelDescriptor[];
  /**
   * The catalog's default, or `null` when there is nothing to default to.
   *
   * It decides whether a single-model catalog may stay hidden: with a default, that one model is
   * already what the next request uses, but **without** one nothing is selected, so the row has to
   * ask for a choice instead of picking silently.
   */
  defaultModelId: string | null;
  /** `disabled` = the deployment has switched the assistant off entirely. */
  isAiDisabled: boolean;
  /** Currently selected catalog id, or `null` when nothing is selected. */
  selectedModelId: string | null;
  onSelectModel: (modelId: string) => void;
  /**
   * True when the next request would exceed the selected model's prompt budget.
   * The caller derives it from the same estimate the metric strip shows.
   */
  isOverBudget: boolean;
  /** Seconds until a rate-limited request may be sent again; 0 = ready. */
  cooldownSeconds: number;
  /**
   * `'inline'` (default) is the drawer's horizontal strip — control beside its
   * notice. `'stacked'` is the Settings card row — control full-width with the
   * notice below it, no padding or surface of its own (the section row owns
   * the geometry, so inline insets would double up).
   */
  layout?: 'inline' | 'stacked';
}

/**
 * Model choice for the next request, sat beside the conversation's cost meter.
 *
 * Rendered when the catalog offers something to say: a choice (two or more models), a single model
 * that nothing is selected for, an empty catalog, or a switched-off assistant. A control with one
 * option whose model is *already* the default stays hidden, because it would state nothing and imply
 * a capability that is not there.
 *
 * The line beside the control answers "what am I getting", and when something is wrong it says which
 * problem it is: a conversation too large for the selected model (switch or start over), shared
 * capacity temporarily exhausted (wait), the assistant switched off by the deployment, or a catalog
 * with nothing in it. None of them is silent — each otherwise shows up as a failed request the user
 * cannot explain.
 */
export function AiModelPicker({
  models,
  defaultModelId,
  isAiDisabled,
  selectedModelId,
  onSelectModel,
  isOverBudget,
  cooldownSeconds,
  layout = 'inline',
}: AiModelPickerProps) {
  const stacked = layout === 'stacked';
  const unavailableNotice = resolvePickerUnavailableNotice(isAiDisabled, models.length > 0);
  if (unavailableNotice) {
    return (
      <div {...stylex.props(styles.row, stacked && styles.rowStacked)}>
        <span {...stylex.props(styles.notice, stacked && styles.noticeStacked, styles.noticeWarning)}>{unavailableNotice}</span>
      </div>
    );
  }

  // One model and a default for it: the choice is already made, so there is nothing to ask.
  if (models.length === 1 && defaultModelId !== null) return null;

  const notice = resolvePickerNotice({
    cooldownSeconds,
    isOverBudget,
    selectedModelId,
    selectedModel: models.find((model) => model.id === selectedModelId),
  });

  return (
    <div {...stylex.props(styles.row, stacked && styles.rowStacked)}>
      <SegmentedControl
        label="AI model for the next message"
        value={selectedModelId ?? ''}
        onChange={(value) => onSelectModel(value)}
        size="sm"
      >
        {models.map((model) => (
          <SegmentedControlItem key={model.id} value={model.id} label={model.display.name} />
        ))}
      </SegmentedControl>
      {notice && (
        <span {...stylex.props(styles.notice, stacked && styles.noticeStacked, notice.isWarning && styles.noticeWarning)}>
          {notice.message}
        </span>
      )}
    </div>
  );
}
