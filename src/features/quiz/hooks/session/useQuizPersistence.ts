import { useCallback, useRef } from 'react';
import type { QuizSession } from '../../../../domain/quiz/QuizSession';
import type { CreateSessionInput } from '../../../../domain/quiz/QuizSessionRepository';
import type { SubmitQuizSessionOutput } from '../../../../application';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';

/**
 * Manages explicit session creation, completion, and lifecycle persistence.
 * Supports the discriminated CreateSessionInput (stored vs virtual quiz sources).
 */
export function useQuizPersistence() {
    const context = useContextOrThrow(ApplicationContext, 'useQuizPersistence');
    const sessionRef = useRef<QuizSession | null>(null);

    const createSession = useCallback(
        async (input: CreateSessionInput): Promise<QuizSession> => {
            const session = await context.useCases.quiz.startSession.execute(input);
            sessionRef.current = session;
            return session;
        },
        [context],
    );

    const completeSession = useCallback(
        async (submissions: Array<{ questionId: string; value: string | string[] | boolean }>): Promise<SubmitQuizSessionOutput> => {
            const session = sessionRef.current;
            if (!session) throw new Error('No active session to complete');
            const output = await context.useCases.quiz.submitSession.execute({ sessionId: session.id, submissions });
            sessionRef.current = output.session;
            return output;
        },
        [context],
    );

    const abandonSession = useCallback(async (): Promise<void> => {
        const session = sessionRef.current;
        if (session) {
            await context.useCases.quiz.abandonSession.execute(session.id);
        }
        sessionRef.current = null;
    }, [context]);

    return { createSession, completeSession, abandonSession, sessionRef };
}
