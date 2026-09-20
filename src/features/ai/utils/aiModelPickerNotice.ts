import { formatCooldownNotice } from './aiRateLimit';

/**
 * Copy for the line beside the model control.
 *
 * Kept out of the component as pure resolvers for two reasons: the wording is the whole point of the
 * line — each state has to name *its own* problem, or the user sees an unexplained failed request —
 * and a component that both decides and renders it accumulates branches until nobody can tell which
 * state is reachable.
 */

/**
 * The dead-end states, where there is no choice left to offer.
 *
 * Both are deployment/shape facts rather than user-fixable ones, so they replace the control instead
 * of annotating it. Returns `null` when there is a choice to show.
 */
export function resolvePickerUnavailableNotice(
  isAiDisabled: boolean,
  hasModels: boolean,
): string | null {
  if (isAiDisabled) return 'The AI assistant is temporarily unavailable.';
  if (!hasModels) return 'No AI models are currently available.';
  return null;
}

export interface AiPickerNotice {
  message: string;
  /**
   * `true` for a state the user has to act on (wait, switch model, or choose one). A plain
   * description of the current model is not a warning.
   */
  isWarning: boolean;
}

export interface AiPickerNoticeInput {
  /** Seconds until a rate-limited request may be sent again; 0 = ready. */
  cooldownSeconds: number;
  /** True when the next request would exceed the selected model's prompt budget. */
  isOverBudget: boolean;
  /** Currently selected catalog id, or `null` when nothing is selected. */
  selectedModelId: string | null;
  /** The selected model's descriptor, when it is in the catalog. */
  selectedModel?: { display: { name: string; tagline?: string } };
}

/**
 * Resolves the line shown beside the control, or `null` when there is nothing worth saying.
 *
 * Order matters: a cooldown outranks an overshoot because waiting is the immediate constraint, and
 * an overshoot outranks the tagline because it is the reason the next send would be refused.
 */
export function resolvePickerNotice(input: AiPickerNoticeInput): AiPickerNotice | null {
  const { cooldownSeconds, isOverBudget, selectedModelId, selectedModel } = input;

  if (cooldownSeconds > 0) {
    return { message: formatCooldownNotice(cooldownSeconds), isWarning: true };
  }

  if (isOverBudget) {
    const name = selectedModel?.display.name ?? 'the selected model';
    return {
      message: `This conversation no longer fits ${name}. Start a new chat or pick another model.`,
      isWarning: true,
    };
  }

  if (selectedModelId === null) {
    return { message: 'Choose a model to start chatting.', isWarning: true };
  }

  const tagline = selectedModel?.display.tagline ?? '';
  // A tagline is a description of the choice already made, never a warning.
  return tagline ? { message: tagline, isWarning: false } : null;
}
