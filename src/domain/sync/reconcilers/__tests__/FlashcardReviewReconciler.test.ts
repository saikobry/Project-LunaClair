import { describe, expect, it } from 'vitest';
import { reconcileFlashcardReview } from '../FlashcardReviewReconciler';
import type { FlashcardReviewSyncPayload } from '../../models/SyncEntities';

describe('FlashcardReviewReconciler (Model A: Deterministic Spaced Repetition Merge)', () => {
    const remoteReview: FlashcardReviewSyncPayload = {
        key: 'q:123',
        repetitions: 3,
        easeFactor: 2.5,
        intervalDays: 15,
        dueAt: '2026-09-15T12:00:00.000Z',
        lapses: 0,
        reviewCount: 3,
        lastReviewedAt: '2026-09-01T12:00:00.000Z',
    };

    it('applies remote flashcard review when local review does not exist', () => {
        const result = reconcileFlashcardReview(null, remoteReview);
        expect(result.kind).toBe('apply');
        if (result.kind === 'apply') {
            expect(result.payload).toEqual(remoteReview);
        }
    });

    it('applies remote review when remote has a more recent lastReviewedAt timestamp', () => {
        const localOlder: FlashcardReviewSyncPayload = {
            ...remoteReview,
            repetitions: 2,
            reviewCount: 2,
            lastReviewedAt: '2026-08-20T12:00:00.000Z',
        };

        const result = reconcileFlashcardReview(localOlder, remoteReview);
        expect(result.kind).toBe('apply');
    });

    it('ignores remote review when local has a more recent lastReviewedAt timestamp', () => {
        const localNewer: FlashcardReviewSyncPayload = {
            ...remoteReview,
            repetitions: 4,
            reviewCount: 4,
            lastReviewedAt: '2026-09-05T12:00:00.000Z',
        };

        const result = reconcileFlashcardReview(localNewer, remoteReview);
        expect(result.kind).toBe('ignore');
        if (result.kind === 'ignore') {
            expect(result.reason).toBe('Local flashcard review is newer');
        }
    });

    it('ignores remote review when states are identical', () => {
        const result = reconcileFlashcardReview(remoteReview, remoteReview);
        expect(result.kind).toBe('ignore');
        if (result.kind === 'ignore') {
            expect(result.reason).toBe('Flashcard review states are identical');
        }
    });
});
