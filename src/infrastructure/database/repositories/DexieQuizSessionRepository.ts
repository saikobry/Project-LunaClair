import type { QuizSession } from '../../../domain/quiz/models/QuizSession';
import type { SubmittedAnswer } from '../../../domain/quiz/models/Answer';
import type { Question } from '../../../domain/quiz/models/Question';
import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type {
    QuizSessionRepository,
    CreateSessionInput,
} from '../../../domain/quiz/repositories/QuizSessionRepository';
import { db } from '../schema/LunaClairDatabase';

function generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export class DexieQuizSessionRepository implements QuizSessionRepository {
    async getSessions(quizId: string, signal?: AbortSignal): Promise<QuizSession[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return db.quizSessions.where('quizId').equals(quizId).toArray();
    }

    async getAllCompletedSessions(signal?: AbortSignal): Promise<QuizSession[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return db.quizSessions.filter((s) => s.status === 'completed').toArray();
    }

    async getSessionById(id: string, signal?: AbortSignal): Promise<QuizSession | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await db.quizSessions.get(id)) ?? null;
    }

    /**
     * Creates a session with immutable question snapshots.
     * Uses a multi-store transaction to atomically read quiz + questions
     * and write the new session.
     * Virtual quizzes ({ source: 'virtual' }) are created in-memory without persisting to db.quizzes.
     */
    async createSession(input: CreateSessionInput): Promise<QuizSession> {
        return db.transaction('rw', [db.quizSessions, db.quizzes, db.questions], async () => {
            let quiz: Quiz | undefined;

            if (input.source === 'virtual') {
                quiz = input.quiz;
            } else {
                quiz = await db.quizzes.get(input.quizId);
                if (!quiz) throw new Error(`Quiz not found: ${input.quizId}`);
            }

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
                quizId: quiz.id,
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
        return db.transaction('rw', [db.quizSessions, db.syncQueue], async () => {
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

            await db.syncQueue.put({
                id: crypto.randomUUID(),
                clientMutationId: crypto.randomUUID(),
                entityType: 'quizSession',
                entityId: id,
                operation: 'APPEND',
                clientTimestamp: updated.completedAt ?? new Date().toISOString(),
                payload: updated,
                status: 'pending',
                createdAt: new Date().toISOString(),
                retryCount: 0,
            });

            return updated;
        });
    }

    async deleteSession(id: string): Promise<void> {
        await db.quizSessions.delete(id);
    }
}

export const dexieQuizSessionRepository = new DexieQuizSessionRepository();
