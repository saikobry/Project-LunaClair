import { useContext, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RepositoryContext } from '../../../app/providers/RepositoryContext';
import type { CreateQuestionInput, UpdateQuestionInput } from '../../../domain/quiz/QuestionRepository';
import { QuizManagementService } from '../services/QuizManagementService';

/**
 * Hook wrapping QuizManagementService for question authoring operations.
 * Provides create, update, publish, and archive mutations with cache invalidation.
 */
export function useQuestionManagement(materialId: string) {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error('useQuestionManagement must be used within a <RepositoryProvider>');
    }

    const service = useMemo(
        () => new QuizManagementService(context.questionRepository, context.quizRepository),
        [context.questionRepository, context.quizRepository],
    );

    const queryClient = useQueryClient();
    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['assessment', 'questions', materialId] });

    const createQuestion = useMutation({
        mutationFn: (input: CreateQuestionInput) => service.createQuestion(input),
        onSettled: invalidate,
    });

    const updateQuestion = useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateQuestionInput }) =>
            service.updateQuestion(id, input),
        onSettled: invalidate,
    });

    const publishQuestion = useMutation({
        mutationFn: (id: string) => service.publishQuestion(id),
        onSettled: invalidate,
    });

    const archiveQuestion = useMutation({
        mutationFn: (id: string) => service.archiveQuestion(id),
        onSettled: invalidate,
    });

    return { createQuestion, updateQuestion, publishQuestion, archiveQuestion };
}
