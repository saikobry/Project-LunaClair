import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateSessionInput } from '../../../domain/quiz/QuizSessionRepository';
import type { SubmittedAnswer } from '../../../domain/quiz/Answer';
import type { QuizScore } from '../../../domain/quiz/QuizSession';
import { assessmentQueryKeys } from '../queries/assessmentQueryKeys';
import { useQuizSessionRepository } from './useQuizSessionRepository';

/** Mutation hooks for quiz session lifecycle operations. */
export function useSessionMutations(quizId: string) {
    const queryClient = useQueryClient();
    const repository = useQuizSessionRepository();

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: assessmentQueryKeys.sessions(quizId) });

    const createSession = useMutation({
        mutationFn: (input: CreateSessionInput) => repository.createSession(input),
        onSettled: invalidate,
    });

    const completeSession = useMutation({
        mutationFn: ({ id, answers, score }: { id: string; answers: SubmittedAnswer[]; score: QuizScore }) =>
            repository.completeSession(id, answers, score),
        onSettled: invalidate,
    });

    const deleteSession = useMutation({
        mutationFn: (id: string) => repository.deleteSession(id),
        onSettled: invalidate,
    });

    return { createSession, completeSession, deleteSession };
}
