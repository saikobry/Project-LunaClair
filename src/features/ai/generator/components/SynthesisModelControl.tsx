import { AiModelPicker } from '../../components/AiModelPicker';
import type { AiModelDescriptor } from '../../../../domain/ai/services/aiModelCatalog';

export interface SynthesisModelControlProps {
  /** `true` when nothing may be sent: the assistant is switched off, or no model resolves. */
  isAiUnavailable: boolean;
  /** Selectable models, in catalog order. */
  models: AiModelDescriptor[];
  /** The catalog's default, or `null` when there is nothing to default to. */
  defaultModelId: string | null;
  /** `true` when the deployment has switched the assistant off entirely. */
  isAiDisabled: boolean;
  /** Catalog id this batch will run on, or `null` when nothing resolves. */
  selectedModelId: string | null;
  onSelectModel: (modelId: string) => void;
  /** Plural noun for the blocked message, e.g. `questions`. */
  noun: string;
}

/**
 * Which model this generation will run on, and the choice to change it for this batch.
 *
 * The picker is the same unit the chat drawer and Settings use, so there is one model vocabulary
 * app-wide rather than a second control that could disagree about which models exist. It is given
 * `layout="stacked"` because the dialog has no horizontal strip to sit in, and `isOverBudget` /
 * `cooldownSeconds` stay at their "nothing to report" values: both are facts about a *conversation*
 * (its accumulated context, its rate-limit clock), and a generation is a single request with no
 * history behind it.
 *
 * The choice is deliberately **per batch and never persisted** — it does not touch the device's
 * preferred model, so picking MAX here (a shared, rate-limited endpoint) cannot re-route later chat
 * messages. The note below the control says so, because a model control that silently rewrote the
 * chat preference would be exactly the kind of substitution this surface is supposed to avoid.
 *
 * A blocked assistant replaces the control entirely and names the reason: a picker the user cannot
 * act on would imply a capability that is not there, and Generate is disabled to match.
 */
export function SynthesisModelControl({
  isAiUnavailable,
  models,
  defaultModelId,
  isAiDisabled,
  selectedModelId,
  onSelectModel,
  noun,
}: SynthesisModelControlProps) {
  if (isAiUnavailable) {
    return (
      <div style={{ fontSize: 12, color: 'var(--color-warning)' }}>
        The AI assistant is unavailable right now, so {noun} cannot be generated.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <AiModelPicker
        models={models}
        defaultModelId={defaultModelId}
        isAiDisabled={isAiDisabled}
        selectedModelId={selectedModelId}
        onSelectModel={onSelectModel}
        isOverBudget={false}
        cooldownSeconds={0}
        layout="stacked"
        controlLabel="AI model for this generation"
      />
      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
        Applies to this batch only — your chat model is unchanged.
      </span>
    </div>
  );
}
