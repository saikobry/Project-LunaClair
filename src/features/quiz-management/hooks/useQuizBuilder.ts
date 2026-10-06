import { useContext } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';

/**
 * Hook managing quiz publishing and lifecycle transitions.
 * Thin React adapter for quiz-management use cases.
 *
 * Creation and editing are NOT here: a quiz is authored on the canvas, whose
 * write path is `SaveQuizUseCase` (atomic draft commit). The former
 * `createQuiz` / `updateQuiz` mutations had no consumer left after the editor
 * dialog was replaced by the canvas route and were removed rather than kept as
 * an unused second write path into the quiz catalog.
 */
export function useQuizBuilder() {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('useQuizBuilder must be used within a <ApplicationProvider>');
    }

    const queryClient = useQueryClient();
    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['assessment'] });

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

    return { publishQuiz, archiveQuiz, unarchiveQuiz };
}
