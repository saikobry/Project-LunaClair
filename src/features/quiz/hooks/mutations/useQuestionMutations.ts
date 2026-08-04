import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateQuestionInput, UpdateQuestionInput } from '../../../../domain/quiz/QuestionRepository';
import { assessmentQueryKeys } from '../../queries/assessmentQueryKeys';
import { useQuestionRepository } from '../repositories/useQuestionRepository';

/** Mutation hooks for question CRUD operations. */
export function useQuestionMutations(materialId: string) {
    const queryClient = useQueryClient();
    const repository = useQuestionRepository();

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: assessmentQueryKeys.questions(materialId) });

    const createQuestion = useMutation({
        mutationFn: (input: CreateQuestionInput) => repository.createQuestion(input),
        onSettled: invalidate,
    });

    const updateQuestion = useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateQuestionInput }) =>
            repository.updateQuestion(id, input),
        onSettled: invalidate,
    });

    const deleteQuestion = useMutation({
        mutationFn: (id: string) => repository.deleteQuestion(id),
        onSettled: invalidate,
    });

    return { createQuestion, updateQuestion, deleteQuestion };
}
