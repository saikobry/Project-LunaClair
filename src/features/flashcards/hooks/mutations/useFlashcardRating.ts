import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { flashcardQueryKeys } from '../../queries/flashcardQueryKeys';
import type { Rating, ReviewState } from '../../../../domain/flashcards/scheduler';

interface RecordRatingInput {
    key: string;
    materialId: string;
    existingState?: ReviewState;
    rating: Rating;
}

export function useFlashcardRating(materialId: string) {
    const context = useContextOrThrow(ApplicationContext, 'useFlashcardRating');
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: ({ key, materialId: matId, existingState, rating }: RecordRatingInput) =>
            context.useCases.flashcards.recordReview.execute({
                key,
                materialId: matId,
                existingState,
                rating,
            }),

        onSuccess: (newState) => {
            queryClient.setQueryData<Record<string, ReviewState>>(
                flashcardQueryKeys.reviews(materialId),
                (old) => ({
                    ...old,
                    [newState.key]: newState,
                })
            );
            queryClient.invalidateQueries({ queryKey: ['analytics'] });
        },
    });

    return {
        recordRating: mutation.mutateAsync,
        isSubmitting: mutation.isPending,
    };
}
