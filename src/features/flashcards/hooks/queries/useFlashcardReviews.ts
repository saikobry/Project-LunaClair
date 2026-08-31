import { useQuery } from '@tanstack/react-query';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { flashcardQueryKeys } from '../../queries/flashcardQueryKeys';
import type { ReviewState } from '../../../../domain/flashcards/scheduler';

export function useFlashcardReviews(materialId: string) {
    const context = useContextOrThrow(ApplicationContext, 'useFlashcardReviews');

    const { data, isLoading, isError, error } = useQuery({
        queryKey: flashcardQueryKeys.reviews(materialId),
        queryFn: async () => {
            const repository = context.repositories.flashcardReview;
            const reviews = await repository.getByMaterial(materialId);
            const map: Record<string, ReviewState> = {};
            for (const r of reviews) {
                map[r.key] = r;
            }
            return map;
        },
        enabled: Boolean(materialId),
    });

    return {
        reviews: data ?? {},
        isLoading,
        isError,
        error,
    };
}
