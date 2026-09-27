import { useContext } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import type { CreateQuestionInput, UpdateQuestionInput } from '../../../domain/quiz/repositories/QuestionRepository';

/**
 * Thin React adapter for question authoring use cases.
 * Provides create, update, publish, and archive mutations with cache invalidation.
 */
export function useQuestionManagement() {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('useQuestionManagement must be used within a <ApplicationProvider>');
    }

    const queryClient = useQueryClient();
    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['assessment'] });

    const createQuestion = useMutation({
        mutationFn: (input: CreateQuestionInput) => context.useCases.quizManagement.createQuestion.execute(input),
        onSettled: invalidate,
    });

    const updateQuestion = useMutation({
        mutationFn: async ({ id, input }: { id: string; input: UpdateQuestionInput }) => {
            // Bracket the write with the review-reset lifecycle. `capture` must
            // run first: the input is partial, so once the row is written the old
            // cloze content is gone and nothing can tell whether it moved.
            const before = await context.useCases.flashcards.resetReviews.capture([id]);
            const question = await context.useCases.quizManagement.updateQuestion.execute(id, input);
            await context.useCases.flashcards.resetReviews.execute({ before });
            return question;
        },
        onSettled: invalidate,
    });

    const publishQuestion = useMutation({
        mutationFn: (id: string) => context.useCases.quizManagement.publishQuestion.execute(id),
        onSettled: invalidate,
    });

    const archiveQuestion = useMutation({
        mutationFn: (id: string) => context.useCases.quizManagement.archiveQuestion.execute(id),
        onSettled: invalidate,
    });

    const unarchiveQuestion = useMutation({
        mutationFn: (id: string) => context.useCases.quizManagement.unarchiveQuestion.execute(id),
        onSettled: invalidate,
    });

    return { createQuestion, updateQuestion, publishQuestion, archiveQuestion, unarchiveQuestion };
}
