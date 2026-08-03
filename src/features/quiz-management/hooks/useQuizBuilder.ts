import { useContext } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import type { CreateQuizInput, UpdateQuizInput } from '../../../domain/quiz/QuizRepository';
import type { Question } from '../../../domain/quiz/Question';

/**
 * Hook managing quiz creation/editing, version pinning, and question associations.
 * Thin React adapter for quiz-management use cases.
 */
export function useQuizBuilder() {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('useQuizBuilder must be used within a <ApplicationProvider>');
    }

    const queryClient = useQueryClient();
    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['assessment'] });

    const createQuiz = useMutation({
        mutationFn: ({ input, questions }: { input: CreateQuizInput; questions: Question[] }) =>
            context.useCases.quizManagement.createQuiz.execute(input, questions),
        onSettled: invalidate,
    });

    const updateQuiz = useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateQuizInput }) =>
            context.useCases.quizManagement.updateQuiz.execute(id, input),
        onSettled: invalidate,
    });

    const publishQuiz = useMutation({
        mutationFn: (id: string) => context.useCases.quizManagement.publishQuiz.execute(id),
        onSettled: invalidate,
    });

    const archiveQuiz = useMutation({
        mutationFn: (id: string) => context.useCases.quizManagement.archiveQuiz.execute(id),
        onSettled: invalidate,
    });

    const unarchiveQuiz = useMutation({
        mutationFn: (id: string) => context.useCases.quizManagement.unarchiveQuiz.execute(id),
        onSettled: invalidate,
    });

    return { createQuiz, updateQuiz, publishQuiz, archiveQuiz, unarchiveQuiz };
}
