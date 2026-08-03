import { useContext, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import type { CreateQuizInput, UpdateQuizInput } from '../../../domain/quiz/QuizRepository';
import type { Question } from '../../../domain/quiz/Question';
import { QuizManagementService } from '../services/QuizManagementService';

/**
 * Hook managing quiz creation/editing, version pinning, and question associations.
 * Wraps QuizManagementService with TanStack Query mutations and cache invalidation.
 */
export function useQuizBuilder() {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('useQuizBuilder must be used within a <ApplicationProvider>');
    }

    const service = useMemo(
        () => new QuizManagementService(context.questionRepository, context.quizRepository),
        [context.questionRepository, context.quizRepository],
    );

    const queryClient = useQueryClient();
    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['assessment'] });

    const createQuiz = useMutation({
        mutationFn: ({ input, questions }: { input: CreateQuizInput; questions: Question[] }) =>
            service.createQuiz(input, questions),
        onSettled: invalidate,
    });

    const updateQuiz = useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateQuizInput }) =>
            service.updateQuiz(id, input),
        onSettled: invalidate,
    });

    const publishQuiz = useMutation({
        mutationFn: (id: string) => service.publishQuiz(id),
        onSettled: invalidate,
    });

    const archiveQuiz = useMutation({
        mutationFn: (id: string) => service.archiveQuiz(id),
        onSettled: invalidate,
    });

    const unarchiveQuiz = useMutation({
        mutationFn: (id: string) => service.unarchiveQuiz(id),
        onSettled: invalidate,
    });

    return { createQuiz, updateQuiz, publishQuiz, archiveQuiz, unarchiveQuiz };
}
