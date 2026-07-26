import { useQuery } from '@tanstack/react-query';
import { assessmentQueryKeys } from '../queries/assessmentQueryKeys';
import { useQuizRepository } from './useQuizRepository';

/** Fetches all quizzes for a given material. */
export function useQuizzes(materialId: string) {
    const repository = useQuizRepository();

    const { data, isLoading, isError, error } = useQuery({
        queryKey: assessmentQueryKeys.quizzes(materialId),
        queryFn: ({ signal }) => repository.getQuizzes(materialId, signal),
        enabled: materialId.length > 0,
    });

    return { quizzes: data ?? [], isLoading, isError, error };
}
