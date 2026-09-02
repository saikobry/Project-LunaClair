import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type {
    QuizRepository,
    CreateQuizInput,
    UpdateQuizInput,
} from '../../../domain/quiz/repositories/QuizRepository';
import { db } from '../LunaClairDatabase';

function generateId(): string {
    return `quiz-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export class DexieQuizRepository implements QuizRepository {
    async getQuizzes(materialId: string, signal?: AbortSignal): Promise<Quiz[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return db.quizzes.where('materialId').equals(materialId).toArray();
    }

    async getQuizById(id: string, signal?: AbortSignal): Promise<Quiz | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await db.quizzes.get(id)) ?? null;
    }

    async getQuizzesForMaterials(materialIds: string[], signal?: AbortSignal): Promise<Quiz[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (materialIds.length === 0) return [];
        return db.quizzes.where('materialId').anyOf(materialIds).toArray();
    }

    async getQuizzesByIds(ids: string[], signal?: AbortSignal): Promise<Quiz[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (ids.length === 0) return [];
        return db.quizzes.where('id').anyOf(ids).toArray();
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
        await db.quizzes.put(quiz);
        return quiz;
    }

    async updateQuiz(id: string, input: UpdateQuizInput): Promise<Quiz> {
        const existing = await db.quizzes.get(id);
        if (!existing) throw new Error(`Quiz not found: ${id}`);

        const updated: Quiz = {
            ...existing,
            ...input,
            updatedAt: new Date().toISOString(),
        };
        await db.quizzes.put(updated);
        return updated;
    }

    async deleteQuiz(id: string): Promise<void> {
        await db.quizzes.delete(id);
    }
}

export const dexieQuizRepository = new DexieQuizRepository();
