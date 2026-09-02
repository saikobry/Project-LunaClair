import { describe, it, expect } from 'vitest';
import {
  evaluateDocumentConcurrency,
  nextEntityVersion,
  compareLwwTimestamps,
  compareFlashcardReviews,
} from '../syncVersioning';
import type { FlashcardReviewSyncPayload } from '../../models/SyncEntities';

describe('Sync Versioning & Concurrency Resolution', () => {
  describe('evaluateDocumentConcurrency', () => {
    it('returns match when base version equals server version', () => {
      expect(evaluateDocumentConcurrency(1, 1)).toBe('match');
      expect(evaluateDocumentConcurrency(5, 5)).toBe('match');
      expect(evaluateDocumentConcurrency(0, 0)).toBe('match');
    });

    it('returns conflict when base version diverges from server version', () => {
      expect(evaluateDocumentConcurrency(1, 2)).toBe('conflict');
      expect(evaluateDocumentConcurrency(0, 1)).toBe('conflict');
      expect(evaluateDocumentConcurrency(3, 2)).toBe('conflict');
    });
  });

  describe('nextEntityVersion', () => {
    it('returns 1 for undefined or 0 current version', () => {
      expect(nextEntityVersion(undefined)).toBe(1);
      expect(nextEntityVersion(0)).toBe(1);
    });

    it('increments version monotonically', () => {
      expect(nextEntityVersion(1)).toBe(2);
      expect(nextEntityVersion(2)).toBe(3);
      expect(nextEntityVersion(99)).toBe(100);
    });
  });

  describe('compareLwwTimestamps', () => {
    it('returns local_wins when local timestamp is more recent', () => {
      const local = '2026-08-27T12:00:00.000Z';
      const remote = '2026-08-27T11:00:00.000Z';
      expect(compareLwwTimestamps(local, remote)).toBe('local_wins');
    });

    it('returns remote_wins when remote timestamp is more recent', () => {
      const local = '2026-08-27T11:00:00.000Z';
      const remote = '2026-08-27T12:00:00.000Z';
      expect(compareLwwTimestamps(local, remote)).toBe('remote_wins');
    });

    it('returns equal when timestamps are identical', () => {
      const ts = '2026-08-27T12:00:00.000Z';
      expect(compareLwwTimestamps(ts, ts)).toBe('equal');
    });

    it('falls back gracefully on non-standard timestamp strings', () => {
      expect(compareLwwTimestamps('2026-08-27B', '2026-08-27A')).toBe('local_wins');
      expect(compareLwwTimestamps('2026-08-27A', '2026-08-27B')).toBe('remote_wins');
      expect(compareLwwTimestamps('abc', 'abc')).toBe('equal');
    });
  });

  describe('compareFlashcardReviews', () => {
    const baseReview: FlashcardReviewSyncPayload = {
      key: 'card-1',
      repetitions: 2,
      easeFactor: 2.5,
      intervalDays: 6,
      dueAt: '2026-09-01T00:00:00.000Z',
      lapses: 0,
      reviewCount: 2,
    };

    it('resolves by lastReviewedAt recency when both have review timestamps', () => {
      const local: FlashcardReviewSyncPayload = {
        ...baseReview,
        lastReviewedAt: '2026-08-27T12:00:00.000Z',
        repetitions: 1, // lower reps but newer review
      };
      const remote: FlashcardReviewSyncPayload = {
        ...baseReview,
        lastReviewedAt: '2026-08-27T10:00:00.000Z',
        repetitions: 5,
      };

      expect(compareFlashcardReviews(local, remote)).toBe('local_wins');
      expect(compareFlashcardReviews(remote, local)).toBe('remote_wins');
    });

    it('prefers reviewed state over unreviewed state', () => {
      const reviewed: FlashcardReviewSyncPayload = {
        ...baseReview,
        lastReviewedAt: '2026-08-27T10:00:00.000Z',
        repetitions: 1,
      };
      const unreviewed: FlashcardReviewSyncPayload = {
        ...baseReview,
        lastReviewedAt: undefined,
        repetitions: 0,
      };

      expect(compareFlashcardReviews(reviewed, unreviewed)).toBe('local_wins');
      expect(compareFlashcardReviews(unreviewed, reviewed)).toBe('remote_wins');
    });

    it('tie-breaks on higher repetitions when lastReviewedAt is identical or absent', () => {
      const higherReps: FlashcardReviewSyncPayload = {
        ...baseReview,
        lastReviewedAt: '2026-08-27T10:00:00.000Z',
        repetitions: 3,
        reviewCount: 3,
      };
      const lowerReps: FlashcardReviewSyncPayload = {
        ...baseReview,
        lastReviewedAt: '2026-08-27T10:00:00.000Z',
        repetitions: 1,
        reviewCount: 1,
      };

      expect(compareFlashcardReviews(higherReps, lowerReps)).toBe('local_wins');
      expect(compareFlashcardReviews(lowerReps, higherReps)).toBe('remote_wins');
    });

    it('tie-breaks on higher reviewCount when repetitions are equal', () => {
      const higherReviews: FlashcardReviewSyncPayload = {
        ...baseReview,
        lastReviewedAt: undefined,
        repetitions: 0,
        reviewCount: 5,
      };
      const lowerReviews: FlashcardReviewSyncPayload = {
        ...baseReview,
        lastReviewedAt: undefined,
        repetitions: 0,
        reviewCount: 2,
      };

      expect(compareFlashcardReviews(higherReviews, lowerReviews)).toBe('local_wins');
      expect(compareFlashcardReviews(lowerReviews, higherReviews)).toBe('remote_wins');
    });

    it('returns equal when all review comparison criteria match', () => {
      const local: FlashcardReviewSyncPayload = {
        ...baseReview,
        lastReviewedAt: '2026-08-27T10:00:00.000Z',
        repetitions: 2,
        reviewCount: 2,
      };
      const remote: FlashcardReviewSyncPayload = {
        ...baseReview,
        lastReviewedAt: '2026-08-27T10:00:00.000Z',
        repetitions: 2,
        reviewCount: 2,
      };

      expect(compareFlashcardReviews(local, remote)).toBe('equal');
    });
  });
});
