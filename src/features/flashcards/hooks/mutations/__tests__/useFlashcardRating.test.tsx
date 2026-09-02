import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFlashcardRating } from '../useFlashcardRating';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';
import { flashcardQueryKeys } from '../../../queries/flashcardQueryKeys';
import type { ReviewState } from '../../../../../domain/flashcards/engines/scheduler';

describe('useFlashcardRating', () => {
    let queryClient: QueryClient;
    let mockRecordReview: { execute: ReturnType<typeof vi.fn> };
    let mockContext: any;

    const mockUpdatedReview: ReviewState = {
        key: 'card-1',
        materialId: 'mat-1',
        repetitions: 1,
        easeFactor: 2.5,
        intervalDays: 1,
        dueAt: '2026-09-03T10:00:00.000Z',
        lastReviewedAt: '2026-09-02T10:00:00.000Z',
        lapses: 0,
        reviewCount: 1,
    };

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });

        mockRecordReview = {
            execute: vi.fn().mockResolvedValue(mockUpdatedReview),
        };

        mockContext = {
            useCases: {
                flashcards: {
                    recordReview: mockRecordReview,
                },
            },
        };
    });

    const createWrapper = () => ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ApplicationContext.Provider value={mockContext}>
                {children}
            </ApplicationContext.Provider>
        </QueryClientProvider>
    );

    it('records review rating, updates review query cache, and invalidates analytics', async () => {
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
        const { result } = renderHook(() => useFlashcardRating('mat-1'), { wrapper: createWrapper() });

        await act(async () => {
            await result.current.recordRating({
                key: 'card-1',
                materialId: 'mat-1',
                rating: 'good',
            });
        });

        expect(mockRecordReview.execute).toHaveBeenCalledWith({
            key: 'card-1',
            materialId: 'mat-1',
            existingState: undefined,
            rating: 'good',
        });

        // Query cache should be updated with new review state
        const cachedReviews = queryClient.getQueryData<Record<string, ReviewState>>(
            flashcardQueryKeys.reviews('mat-1'),
        );
        expect(cachedReviews?.['card-1']).toEqual(mockUpdatedReview);

        // Analytics query cache should be invalidated
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['analytics'] });
    });
});
