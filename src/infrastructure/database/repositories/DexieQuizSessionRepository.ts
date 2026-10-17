import type { QuizSession } from '../../../domain/quiz/models/QuizSession';
import type { SubmittedAnswer } from '../../../domain/quiz/models/Answer';
import type { Question } from '../../../domain/quiz/models/Question';
import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type {
    QuizSessionRepository,
    CreateSessionInput,
} from '../../../domain/quiz/repositories/QuizSessionRepository';
import { getActiveVaultDatabase, type LunaClairDatabase } from '../schema/LunaClairDatabase';
import { withOrigin } from '../sync/transactionContext';

function generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export class DexieQuizSessionRepository implements QuizSessionRepository {
    private readonly db: LunaClairDatabase;

    constructor(database: LunaClairDatabase = getActiveVaultDatabase()) {
        this.db = database;
    }

    async getSessions(quizId: string, signal?: AbortSignal): Promise<QuizSession[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return this.db.quizSessions.where('quizId').equals(quizId).toArray();
    }

    async getAllCompletedSessions(signal?: AbortSignal): Promise<QuizSession[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        // Index lookup instead of a full-store scan with a JS predicate (v15 added `status`).
        return this.db.quizSessions.where('status').equals('completed').toArray();
    }

    async getSessionById(id: string, signal?: AbortSignal): Promise<QuizSession | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await this.db.quizSessions.get(id)) ?? null;
    }

    /**
     * Creates a session with immutable question snapshots.
     * Uses a multi-store transaction to atomically read quiz + questions
     * and write the new session.
     * Virtual quizzes ({ source: 'virtual' }) are created in-memory without persisting to db.quizzes.
     */
    async createSession(input: CreateSessionInput): Promise<QuizSession> {
        return withOrigin(this.db, 'local', [this.db.quizSessions, this.db.quizzes, this.db.questions], async () => {
            let quiz: Quiz | undefined;

            if (input.source === 'virtual') {
                quiz = input.quiz;
            } else {
                quiz = await this.db.quizzes.get(input.quizId);
                if (!quiz) throw new Error(`Quiz not found: ${input.quizId}`);
            }

            const questions = await this.db.questions
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

            await this.db.quizSessions.put(session);
            return session;
        });
    }

    async completeSession(
        id: string,
        answers: SubmittedAnswer[],
        score: QuizSession['score'],
    ): Promise<QuizSession> {
        return withOrigin(this.db, 'local', [this.db.quizSessions, this.db.quizzes, this.db.questions], async () => {
            const existing = await this.db.quizSessions.get(id);
            if (!existing) throw new Error(`QuizSession not found: ${id}`);

            const updated: QuizSession = {
                ...existing,
                status: 'completed',
                answers,
                score,
                completedAt: new Date().toISOString(),
            };
            await this.db.quizSessions.put(updated);

            await this.db.syncQueue.put({
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

    async updateSession(session: QuizSession): Promise<void> {
        await withOrigin(this.db, 'local', [this.db.quizSessions, this.db.quizzes, this.db.questions], async () => {
            await this.db.quizSessions.put(session);
        });
    }

    async deleteSession(id: string): Promise<void> {
        await withOrigin(this.db, 'local', [this.db.quizSessions, this.db.quizzes, this.db.questions], async () => {
            await this.db.quizSessions.delete(id);
        });
    }
}

export const dexieQuizSessionRepository = new DexieQuizSessionRepository();
