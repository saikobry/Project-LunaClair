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
};
