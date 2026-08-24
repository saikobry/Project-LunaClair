import type { QuizSession } from './QuizSession';
import type { Quiz } from './Quiz';
import type { QuizMode } from './QuizMode';
import type { SubmittedAnswer } from './Answer';

/** Discriminated session creation contract. */
export type CreateSessionInput =
    | { source: 'stored'; quizId: string; mode: QuizMode }
    | { source: 'virtual'; quiz: Quiz; mode: QuizMode };

export interface QuizSessionRepository {
    getSessions(quizId: string, signal?: AbortSignal): Promise<QuizSession[]>;
    getAllCompletedSessions(signal?: AbortSignal): Promise<QuizSession[]>;
    getSessionById(id: string, signal?: AbortSignal): Promise<QuizSession | null>;
    /**
     * Creates a new quiz session with immutable question snapshots.
     * Implementations must capture the current state of all quiz questions
     * into `questionSnapshots` at creation time.
     * Virtual quizzes ({ source: 'virtual' }) are used in-memory without persisting to db.quizzes.
     */
    createSession(input: CreateSessionInput): Promise<QuizSession>;
    /** Submits answers and finalizes the session with a computed score. */
    completeSession(id: string, answers: SubmittedAnswer[], score: QuizSession['score']): Promise<QuizSession>;
    deleteSession(id: string): Promise<void>;
}
