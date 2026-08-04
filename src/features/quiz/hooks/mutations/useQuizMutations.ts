import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateQuizInput, UpdateQuizInput } from '../../../../domain/quiz/QuizRepository';
import { assessmentQueryKeys } from '../../queries/assessmentQueryKeys';
import { useQuizRepository } from '../repositories/useQuizRepository';

/** Mutation hooks for quiz CRUD operations. */
export function useQuizMutations(materialId: string) {
    const queryClient = useQueryClient();
    const repository = useQuizRepository();

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: assessmentQueryKeys.quizzes(materialId) });

    const createQuiz = useMutation({
        mutationFn: (input: CreateQuizInput) => repository.createQuiz(input),
        onSettled: invalidate,
    });

    const updateQuiz = useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateQuizInput }) =>
            repository.updateQuiz(id, input),
        onSettled: invalidate,
    });

    const deleteQuiz = useMutation({
        mutationFn: (id: string) => repository.deleteQuiz(id),
        onSettled: invalidate,
    });

    return { createQuiz, updateQuiz, deleteQuiz };
}
