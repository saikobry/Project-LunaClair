import type { QuizSession } from '../../../domain/quiz/QuizSession';
import type { SubmittedAnswer } from '../../../domain/quiz/Answer';
import type { Question } from '../../../domain/quiz/Question';
import type {
    QuizSessionRepository,
    CreateSessionInput,
} from '../../../domain/quiz/QuizSessionRepository';
import { db } from '../LunaClairDatabase';

function generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export class DexieQuizSessionRepository implements QuizSessionRepository {
    async getSessions(quizId: string, signal?: AbortSignal): Promise<QuizSession[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return db.quizSessions.where('quizId').equals(quizId).toArray();
    }

    async getSessionById(id: string, signal?: AbortSignal): Promise<QuizSession | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await db.quizSessions.get(id)) ?? null;
    }

    /**
     * Creates a session with immutable question snapshots.
     * Uses a multi-store transaction to atomically read quiz + questions
     * and write the new session.
     */
    async createSession(input: CreateSessionInput): Promise<QuizSession> {
        return db.transaction('rw', [db.quizSessions, db.quizzes, db.questions], async () => {
            const quiz = await db.quizzes.get(input.quizId);
            if (!quiz) throw new Error(`Quiz not found: ${input.quizId}`);

            const questions = await db.questions
                .where('id')
                .anyOf(quiz.questionIds)
                .toArray();

            const questionSnapshots: Record<string, Question> = {};
            for (const q of questions) {
                questionSnapshots[q.id] = { ...q };
            }

            const session: QuizSession = {
                id: generateId(),
                quizId: input.quizId,
                mode: input.mode,
                status: 'in_progress',
                questionSnapshots,
                answers: [],
                startedAt: new Date().toISOString(),
            };

            await db.quizSessions.put(session);
            return session;
        });
    }

    async completeSession(
        id: string,
        answers: SubmittedAnswer[],
        score: QuizSession['score'],
    ): Promise<QuizSession> {
        const existing = await db.quizSessions.get(id);
        if (!existing) throw new Error(`QuizSession not found: ${id}`);

        const updated: QuizSession = {
            ...existing,
            status: 'completed',
            answers,
            score,
            completedAt: new Date().toISOString(),
        };
        await db.quizSessions.put(updated);
        return updated;
    }

    async deleteSession(id: string): Promise<void> {
        await db.quizSessions.delete(id);
    }
}

export const dexieQuizSessionRepository = new DexieQuizSessionRepository();
