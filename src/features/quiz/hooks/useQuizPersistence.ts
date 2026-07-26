import { useCallback, useRef } from 'react';
import type { QuizSession } from '../../../domain/quiz/QuizSession';
import type { QuizMode } from '../../../domain/quiz/QuizMode';
import type { SubmittedAnswer } from '../../../domain/quiz/Answer';
import type { QuizScore } from '../../../domain/quiz/QuizSession';
import { useQuizSessionRepository } from './useQuizSessionRepository';

/**
 * Manages explicit session creation, completion, and lifecycle persistence.
 */
export function useQuizPersistence() {
    const repository = useQuizSessionRepository();
    const sessionRef = useRef<QuizSession | null>(null);

    const createSession = useCallback(
        async (quizId: string, mode: QuizMode): Promise<QuizSession> => {
            const session = await repository.createSession({ quizId, mode });
            sessionRef.current = session;
            return session;
        },
        [repository],
    );

    const completeSession = useCallback(
        async (answers: SubmittedAnswer[], score: QuizScore): Promise<QuizSession> => {
            const session = sessionRef.current;
            if (!session) throw new Error('No active session to complete');
            const completed = await repository.completeSession(session.id, answers, score);
            sessionRef.current = completed;
            return completed;
        },
        [repository],
    );

    const abandonSession = useCallback(async (): Promise<void> => {
        const session = sessionRef.current;
        if (session && session.status === 'in_progress') {
            await repository.deleteSession(session.id);
        }
        sessionRef.current = null;
    }, [repository]);

    return { createSession, completeSession, abandonSession, sessionRef };
}
