import * as stylex from '@stylexjs/stylex';
import { SegmentedControl, SegmentedControlItem } from '../../../shared/ui/SegmentedControl/SegmentedControl';
import type { AiModelDescriptor } from '../../../domain/ai/services/aiModelCatalog';
import { formatCooldownNotice } from '../utils/aiRateLimit';

const styles = stylex.create({
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '6px 16px 8px',
    backgroundColor: 'var(--color-background-surface)',
  },
  notice: {
    fontSize: 11,
    lineHeight: 1.35,
    textAlign: 'right',
    color: 'var(--color-text-secondary)',
  },
  noticeWarning: {
    color: 'var(--color-warning)',
  },
});

export interface AiModelPickerProps {
  /** Selectable models, in catalog order. */
  models: AiModelDescriptor[];
  /** Currently selected catalog id. */
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  /**
   * True when the next request would exceed the selected model's prompt budget.
   * The caller derives it from the same estimate the metric strip shows.
   */
  isOverBudget: boolean;
  /** Seconds until a rate-limited request may be sent again; 0 = ready. */
  cooldownSeconds: number;
}

/**
 * Model choice for the next request, sat beside the conversation's cost meter.
 *
 * Only rendered when the catalog offers a choice — a segmented control with one option states
 * nothing and would imply a capability that is not there.
 *
 * The line under the control answers "what am I getting", and when something is wrong it says which
 * of the two different problems it is: a conversation too large for the selected model (switch or
 * start over) or shared capacity temporarily exhausted (wait). Neither is silent, because both
 * otherwise show up as a failed request the user cannot explain.
 */
export function AiModelPicker({
  models,
  selectedModelId,
  onSelectModel,
  isOverBudget,
  cooldownSeconds,
}: AiModelPickerProps) {
  if (models.length < 2) return null;

  const selected = models.find((model) => model.id === selectedModelId);
  const isCoolingDown = cooldownSeconds > 0;
  const notice = isCoolingDown
    ? formatCooldownNotice(cooldownSeconds)
    : isOverBudget
      ? `This conversation no longer fits ${selected?.display.name ?? 'the selected model'}. Start a new chat or pick another model.`
      : (selected?.display.tagline ?? '');

  return (
    <div {...stylex.props(styles.row)}>
      <SegmentedControl
        label="AI model for the next message"
        value={selectedModelId}
        onChange={(value) => onSelectModel(value)}
        size="sm"
      >
        {models.map((model) => (
          <SegmentedControlItem key={model.id} value={model.id} label={model.display.name} />
        ))}
      </SegmentedControl>
      {notice && (
        <span
          {...stylex.props(
            styles.notice,
            (isCoolingDown || isOverBudget) && styles.noticeWarning,
          )}
        >
          {notice}
        </span>
      )}
    </div>
  );
}
