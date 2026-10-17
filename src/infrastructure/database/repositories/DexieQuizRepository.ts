import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type {
    QuizRepository,
    CreateQuizInput,
    UpdateQuizInput,
} from '../../../domain/quiz/repositories/QuizRepository';
import { getActiveVaultDatabase, type LunaClairDatabase } from '../schema/LunaClairDatabase';
import { withOrigin } from '../sync/transactionContext';

function generateId(): string {
    return `quiz-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export class DexieQuizRepository implements QuizRepository {
    private readonly db: LunaClairDatabase;

    constructor(database: LunaClairDatabase = getActiveVaultDatabase()) {
        this.db = database;
    }

    async getQuizzes(materialId: string, signal?: AbortSignal): Promise<Quiz[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return this.db.quizzes.where('materialId').equals(materialId).toArray();
    }

    async getQuizById(id: string, signal?: AbortSignal): Promise<Quiz | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await this.db.quizzes.get(id)) ?? null;
    }

    async getQuizzesForMaterials(materialIds: string[], signal?: AbortSignal): Promise<Quiz[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (materialIds.length === 0) return [];
        return this.db.quizzes.where('materialId').anyOf(materialIds).toArray();
    }

    async getQuizzesByIds(ids: string[], signal?: AbortSignal): Promise<Quiz[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (ids.length === 0) return [];
        return this.db.quizzes.where('id').anyOf(ids).toArray();
    }

    async createQuiz(input: CreateQuizInput): Promise<Quiz> {
        const now = new Date().toISOString();
        const id = generateId();
        const quiz: Quiz = {
            id,
            materialId: input.materialId,
            title: input.title,
            description: input.description,
            questionIds: input.questionIds,
            items: (input.items ?? []).map((item) => ({ ...item, quizId: id })),
            status: input.status ?? 'draft',
            timeLimitSeconds: input.timeLimitSeconds,
            passingPercentage: input.passingPercentage,
            createdAt: now,
            updatedAt: now,
        };
        await withOrigin(this.db, 'local', [this.db.quizzes], async () => {
            await this.db.quizzes.put(quiz);
        });
        return quiz;
    }

    async saveQuiz(quiz: Quiz): Promise<void> {
        await withOrigin(this.db, 'local', [this.db.quizzes], async () => {
            await this.db.quizzes.put(quiz);
        });
    }

    async updateQuiz(id: string, input: UpdateQuizInput): Promise<Quiz> {
        return await withOrigin(this.db, 'local', [this.db.quizzes], async () => {
            const existing = await this.db.quizzes.get(id);
            if (!existing) throw new Error(`Quiz not found: ${id}`);

            const updated: Quiz = {
                ...existing,
                ...input,
                updatedAt: new Date().toISOString(),
            };
            await this.db.quizzes.put(updated);
            return updated;
        });
    }

    async deleteQuiz(id: string): Promise<void> {
        await withOrigin(this.db, 'local', [this.db.quizzes], async () => {
            await this.db.quizzes.delete(id);
        });
    }
}

export const dexieQuizRepository = new DexieQuizRepository();
