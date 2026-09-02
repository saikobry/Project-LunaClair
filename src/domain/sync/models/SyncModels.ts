import type { SyncEntityType } from './sync.types';

export type SyncModel = 'lww' | 'append' | 'versioned';

/**
 * Maps each domain entity type to its designated cloud synchronization model:
 * - `versioned`: Model C (optimistic concurrency with conflict drafts on divergence)
 * - `lww`: Model A (last-write-wins by ISO timestamp with soft-delete tombstones)
 * - `append`: Model B (append-only immutable event / historical record stream)
 */
export function getSyncModelForEntity(entityType: SyncEntityType): SyncModel {
  switch (entityType) {
    case 'document':
      return 'versioned';
    case 'highlight':
    case 'drawing':
    case 'flashcardReview':
      return 'lww';
    case 'quizSession':
      return 'append';
  }
}
