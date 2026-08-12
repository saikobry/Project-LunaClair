import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { flashcardQueryKeys } from '../flashcardQueryKeys';
import { review, type Rating, type ReviewState } from '../../../../domain/flashcards/scheduler';

import { dexieFlashcardReviewRepository } from '../../../../infrastructure/database/repositories/DexieFlashcardReviewRepository';

interface RecordRatingInput {
    key: string;
    materialId: string;
    existingState?: ReviewState;
    rating: Rating;
}

export function useFlashcardRating(materialId: string) {
    const context = useContextOrThrow(ApplicationContext, 'useFlashcardRating');
    const queryClient = useQueryClient();
    const repository = context.flashcardReviewRepository ?? context.repositories?.flashcardReviewRepository ?? dexieFlashcardReviewRepository;

    const mutation = useMutation({
        mutationFn: async ({ key, materialId: matId, existingState, rating }: RecordRatingInput) => {
            const newState = review(existingState, rating, new Date());
            newState.key = key;
            (newState as ReviewState & { materialId: string }).materialId = matId;

            await repository.save([newState]);
            return newState;
        },

        onSuccess: (newState) => {
            queryClient.setQueryData<Record<string, ReviewState>>(
                flashcardQueryKeys.reviews(materialId),
                (old) => ({
                    ...old,
                    [newState.key]: newState,
                })
            );
        },
    });

    return {
        recordRating: mutation.mutateAsync,
        isSubmitting: mutation.isPending,
    };
}
