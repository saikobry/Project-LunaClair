import type { AiGroundingTarget } from '../../../application/use-cases/ai/AiGroundingResolver';

/**
 * AI query keys — owns the AI cache namespace (`['ai', ...]`).
 *
 * The catalog lives under a single key for every consumer, which is what makes it shared state
 * rather than one copy per component: the picker, the send guard, and any future consumer (the
 * generator dialogs, a settings surface) read the same entry and are refreshed together.
 */
export const aiQueryKeys = {
  all: ['ai'] as const,
  modelCatalog: () => ['ai', 'model-catalog'] as const,
  groundingContext: (target: AiGroundingTarget, model?: string) =>
    ['ai', 'grounding-context', target, model ?? ''] as const,
  groundingDefault: () => ['ai', 'grounding-default'] as const,
  selectionThreadMode: () => ['ai', 'selection-thread-mode'] as const,
  preferredModel: () => ['ai', 'preferred-model'] as const,
};
