import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SYNC_ENTITY_QUERY_ROOTS,
  resolveQueryRootsForEntities,
  createDebouncedSyncInvalidator,
} from '../syncInvalidation';

describe('syncInvalidation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('resolveQueryRootsForEntities', () => {
    it('maps known entities to their query root keys', () => {
      const roots = resolveQueryRootsForEntities(['material', 'highlight']);
      expect(roots).toEqual([['materials'], ['reader']]);
    });

    it('deduplicates root keys when multiple entities share query roots', () => {
      // document and documentContent both map to ['reader'] and ['materials']
      const roots = resolveQueryRootsForEntities(['document', 'documentContent', 'material']);
      expect(roots).toEqual([['reader'], ['materials']]);
    });

    it('ignores unknown entity types safely', () => {
      const roots = resolveQueryRootsForEntities(['unknown_entity_type', 'drawing']);
      expect(roots).toEqual([['reader']]);
    });

    it('returns empty array when no entities match', () => {
      const roots = resolveQueryRootsForEntities(['unknown1', 'unknown2']);
      expect(roots).toEqual([]);
    });

    it('covers all expected entity types in SYNC_ENTITY_QUERY_ROOTS', () => {
      expect(SYNC_ENTITY_QUERY_ROOTS.material).toEqual([['materials']]);
      expect(SYNC_ENTITY_QUERY_ROOTS.pointer).toEqual([['materials']]);
      expect(SYNC_ENTITY_QUERY_ROOTS.document).toEqual([['reader'], ['materials']]);
      expect(SYNC_ENTITY_QUERY_ROOTS.documentContent).toEqual([['reader'], ['materials']]);
      expect(SYNC_ENTITY_QUERY_ROOTS.drawing).toEqual([['reader']]);
      expect(SYNC_ENTITY_QUERY_ROOTS.highlight).toEqual([['reader']]);
      expect(SYNC_ENTITY_QUERY_ROOTS.quizSession).toContainEqual(['quizzes']);
      expect(SYNC_ENTITY_QUERY_ROOTS.quizSession).toContainEqual(['analytics']);
      expect(SYNC_ENTITY_QUERY_ROOTS.flashcardReview).toEqual([['flashcards'], ['analytics']]);
    });
  });

  describe('createDebouncedSyncInvalidator', () => {
    it('debounces calls and triggers invalidateKey with unique query keys', () => {
      const invalidateKey = vi.fn();
      const invalidator = createDebouncedSyncInvalidator(invalidateKey, 150);

      invalidator.schedule(['material']);
      invalidator.schedule(['document']);

      expect(invalidateKey).not.toHaveBeenCalled();

      // Advance by 149ms (still not called)
      vi.advanceTimersByTime(149);
      expect(invalidateKey).not.toHaveBeenCalled();

      // Advance by 1ms (total 150ms elapsed)
      vi.advanceTimersByTime(1);
      expect(invalidateKey).toHaveBeenCalledTimes(2);
      expect(invalidateKey).toHaveBeenCalledWith(['materials']);
      expect(invalidateKey).toHaveBeenCalledWith(['reader']);
    });

    it('resets timer on rapid consecutive calls', () => {
      const invalidateKey = vi.fn();
      const invalidator = createDebouncedSyncInvalidator(invalidateKey, 150);

      invalidator.schedule(['drawing']);
      vi.advanceTimersByTime(100);

      invalidator.schedule(['quizSession']);
      vi.advanceTimersByTime(100);

      // Total 200ms elapsed, but only 100ms since last schedule
      expect(invalidateKey).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(invalidateKey).toHaveBeenCalled();
    });

    it('cancels pending timer and clears pending keys on cancel()', () => {
      const invalidateKey = vi.fn();
      const invalidator = createDebouncedSyncInvalidator(invalidateKey, 150);

      invalidator.schedule(['material']);
      invalidator.cancel();

      vi.advanceTimersByTime(300);
      expect(invalidateKey).not.toHaveBeenCalled();
    });
  });
});
