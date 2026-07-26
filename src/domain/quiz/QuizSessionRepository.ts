import type { QuizSession } from './QuizSession';
import type { SubmittedAnswer } from './Answer';

export interface CreateSessionInput {
    quizId: string;
    mode: QuizSession['mode'];
}

export interface QuizSessionRepository {
    getSessions(quizId: string, signal?: AbortSignal): Promise<QuizSession[]>;
    getSessionById(id: string, signal?: AbortSignal): Promise<QuizSession | null>;
    /**
     * Creates a new quiz session with immutable question snapshots.
     * Implementations must capture the current state of all quiz questions
     * into `questionSnapshots` at creation time.
     */
    createSession(input: CreateSessionInput): Promise<QuizSession>;
    /** Submits answers and finalizes the session with a computed score. */
    completeSession(id: string, answers: SubmittedAnswer[], score: QuizSession['score']): Promise<QuizSession>;
    deleteSession(id: string): Promise<void>;
}
