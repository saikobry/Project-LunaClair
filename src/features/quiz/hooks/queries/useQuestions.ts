import { useQuery } from '@tanstack/react-query';
import { assessmentQueryKeys } from '../../queries/assessmentQueryKeys';
import { useQuestionRepository } from '../repositories/useQuestionRepository';

/** Fetches all questions for a given material. */
export function useQuestions(materialId: string) {
    const repository = useQuestionRepository();

    const { data, isLoading, isError, error } = useQuery({
        queryKey: assessmentQueryKeys.questions(materialId),
        queryFn: ({ signal }) => repository.getQuestions(materialId, signal),
        enabled: materialId.length > 0,
    });

    return { questions: data ?? [], isLoading, isError, error };
}
