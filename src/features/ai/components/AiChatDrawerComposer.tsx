import type { AiMessageRecord } from '../../../domain/ai/models/ai.types';
import type { AiModelSelection } from '../hooks/useAiModelSelection';
import type { SessionContextEstimate } from '../utils/aiSessionMetrics';
import { AiChatInput } from './AiChatInput';
import { AiModelPicker } from './AiModelPicker';
import { AiSessionMetrics } from './AiSessionMetrics';

export interface AiChatDrawerComposerProps {
  /**
   * `false` while the history panel is showing: the totals and the context estimate describe the
   * transcript on screen, so they step aside with it.
   */
  isVisible: boolean;
  /** Settled turns the usage totals are summed from. */
  messages: AiMessageRecord[];
  /** The next request's estimate, computed once by the drawer and shared with its send guard. */
  context: SessionContextEstimate;
  /** Catalog, selection, and availability, all owned by the drawer's selection hook. */
  model: AiModelSelection;
  /** Seconds until a rate-limited request may be sent again; 0 = ready. */
  cooldownSeconds: number;
  isStreaming: boolean;
  isLoading: boolean;
  selectionExcerpt?: string;
  onSendMessage: (content: string) => void;
  onStopGeneration: () => void;
  onClearSelection?: () => void;
}

/**
 * The bottom strip: session totals, the model choice, and the composer.
 *
 * Extracted as one unit because these three answer a single question — "what will this next message
 * run on, and may I send it?" — and the guard that decides the last part is derived from all three
 * (`no model selected`, `over budget`, `cooling down`). Keeping the derivation beside the controls it
 * is explained by, rather than one level up in the drawer, means the picker's notice and the
 * composer's block cannot be updated independently and drift.
 */
export function AiChatDrawerComposer({
  isVisible,
  messages,
  context,
  model,
  cooldownSeconds,
  isStreaming,
  isLoading,
  selectionExcerpt,
  onSendMessage,
  onStopGeneration,
  onClearSelection,
}: AiChatDrawerComposerProps) {
  if (!isVisible) return null;

  // Only an overshoot blocks on the request's own merits — it has not been refused until it is sent.
  const isOverBudget = context.estimate.isOverBudget;
  const isSendBlocked = model.selectedModel === null || isOverBudget || cooldownSeconds > 0;

  return (
    <>
      <AiSessionMetrics messages={messages} context={context} />
      <AiModelPicker
        models={model.catalog.models}
        defaultModelId={model.catalog.defaultModelId}
        isAiDisabled={model.isAiDisabled}
        selectedModelId={model.selectedModel?.id ?? null}
        onSelectModel={model.selectModel}
        isOverBudget={isOverBudget}
        cooldownSeconds={cooldownSeconds}
      />
      <AiChatInput
        onSendMessage={onSendMessage}
        onStopGeneration={onStopGeneration}
        isStreaming={isStreaming}
        disabled={isLoading}
        isSendBlocked={isSendBlocked}
        selectionExcerpt={selectionExcerpt}
        onClearSelection={onClearSelection}
      />
    </>
  );
}
