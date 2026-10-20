export const SYNC_APPLIED_CHANNEL_NAME = 'lunaclair:sync:applied';

export const SYNC_ENTITY_QUERY_ROOTS: Record<string, readonly (readonly string[])[]> = {
  material: [['materials']],
  pointer: [['materials']],
  document: [['reader'], ['materials']],
  documentContent: [['reader'], ['materials']],
  drawing: [['reader']],
  highlight: [['reader']],
  quizSession: [['quizzes'], ['assessment'], ['analytics']],
  flashcardReview: [['flashcards'], ['analytics']],
  question: [['quizzes'], ['assessment'], ['analytics']],
  quiz: [['quizzes'], ['assessment'], ['analytics']],
  reviewLog: [['flashcards'], ['analytics']],
};

/**
 * Resolves deduplicated query root keys for an array of touched sync entity names.
 */
export function resolveQueryRootsForEntities(
  touchedEntities: readonly string[],
): (readonly string[])[] {
  const seen = new Set<string>();
  const result: (readonly string[])[] = [];

  for (const entity of touchedEntities) {
    const roots = SYNC_ENTITY_QUERY_ROOTS[entity];
    if (!roots) continue;
    for (const root of roots) {
      const keyId = root.join('/');
      if (!seen.has(keyId)) {
        seen.add(keyId);
        result.push(root);
      }
    }
  }

  return result;
}

export interface DebouncedSyncInvalidator {
  schedule(touchedEntities: readonly string[]): void;
  cancel(): void;
}

export function createDebouncedSyncInvalidator(
  invalidateKey: (queryKey: readonly string[]) => void,
  delayMs = 150,
): DebouncedSyncInvalidator {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const pendingKeys = new Set<string>();
  const keyMap = new Map<string, readonly string[]>();

  return {
    schedule(touchedEntities: readonly string[]) {
      const roots = resolveQueryRootsForEntities(touchedEntities);
      for (const root of roots) {
        const keyId = root.join('/');
        pendingKeys.add(keyId);
        keyMap.set(keyId, root);
      }

      if (timer !== null) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        timer = null;
        const keysToInvalidate = Array.from(pendingKeys).map((k) => keyMap.get(k)!);
        pendingKeys.clear();
        keyMap.clear();
        for (const queryKey of keysToInvalidate) {
          invalidateKey(queryKey);
        }
      }, delayMs);
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      pendingKeys.clear();
      keyMap.clear();
    },
  };
}
