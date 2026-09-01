import { describe, expect, it, vi } from 'vitest';
import { RecordFlashcardReviewUseCase } from '../RecordFlashcardReviewUseCase';
import type { FlashcardReviewRepository } from '../../../../domain/flashcards/FlashcardReviewRepository';
import type { ReviewState } from '../../../../domain/flashcards/scheduler';

describe('RecordFlashcardReviewUseCase', () => {
    const fixedNow = new Date('2026-09-01T12:00:00.000Z');

    const createMockRepo = () => {
        const flashcardReviews: FlashcardReviewRepository = {
            getAllReviews: vi.fn().mockResolvedValue([]),
            getByKeys: vi.fn().mockResolvedValue([]),
            getByMaterial: vi.fn().mockResolvedValue([]),
            save: vi.fn().mockResolvedValue(undefined),
            deleteByKeys: vi.fn().mockResolvedValue(undefined),
        };
        return { flashcardReviews };
    };

    it('calculates new review state for a fresh card and persists review record', async () => {
        const { flashcardReviews } = createMockRepo();
        const useCase = new RecordFlashcardReviewUseCase(flashcardReviews);

        const result = await useCase.execute({
            key: 'card-101',
            materialId: 'mat-1',
            rating: 'good',
            now: fixedNow,
        });

        expect(result.key).toBe('card-101');
        expect(result.materialId).toBe('mat-1');
        expect(result.repetitions).toBe(1);
        expect(result.lastReviewedAt).toBe(fixedNow.toISOString());
        expect(result.dueAt).toBeDefined();
        expect(flashcardReviews.save).toHaveBeenCalledWith([result]);
    });

    it('advances existing review state on subsequent review', async () => {
        const existingState: ReviewState = {
            key: 'card-101',
            materialId: 'mat-1',
            repetitions: 1,
            intervalDays: 1,
            easeFactor: 2.5,
            dueAt: '2026-09-01T12:00:00.000Z',
            lastReviewedAt: '2026-08-31T12:00:00.000Z',
            lapses: 0,
            reviewCount: 1,
        };

        const { flashcardReviews } = createMockRepo();
        const useCase = new RecordFlashcardReviewUseCase(flashcardReviews);

        const result = await useCase.execute({
            key: 'card-101',
            materialId: 'mat-1',
            rating: 'good',
            existingState,
            now: fixedNow,
        });

        expect(result.repetitions).toBe(2);
        expect(result.intervalDays).toBeGreaterThan(1);
        expect(result.lastReviewedAt).toBe(fixedNow.toISOString());
        expect(flashcardReviews.save).toHaveBeenCalledWith([result]);
    });

    it('resets interval on rating "again"', async () => {
        const existingState: ReviewState = {
            key: 'card-101',
            materialId: 'mat-1',
            repetitions: 5,
            intervalDays: 15,
            easeFactor: 2.5,
            dueAt: '2026-09-01T12:00:00.000Z',
            lastReviewedAt: '2026-08-15T12:00:00.000Z',
            lapses: 0,
            reviewCount: 5,
        };

        const { flashcardReviews } = createMockRepo();
        const useCase = new RecordFlashcardReviewUseCase(flashcardReviews);

        const result = await useCase.execute({
            key: 'card-101',
            materialId: 'mat-1',
            rating: 'again',
            existingState,
            now: fixedNow,
        });

        expect(result.repetitions).toBe(0);
        expect(result.intervalDays).toBe(1);
        expect(result.lapses).toBe(1);
        expect(flashcardReviews.save).toHaveBeenCalledWith([result]);
    });

    it('propagates repository errors when save fails', async () => {
        const { flashcardReviews } = createMockRepo();
        vi.mocked(flashcardReviews.save).mockRejectedValue(new Error('IndexedDB save failed'));

        const useCase = new RecordFlashcardReviewUseCase(flashcardReviews);

        await expect(
            useCase.execute({
                key: 'card-101',
                materialId: 'mat-1',
                rating: 'good',
                now: fixedNow,
            }),
        ).rejects.toThrow('IndexedDB save failed');
    });
});
