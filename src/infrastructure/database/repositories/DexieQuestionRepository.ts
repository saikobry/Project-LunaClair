import type { Question } from '../../../domain/quiz/Question';
import type {
    QuestionRepository,
    CreateQuestionInput,
    UpdateQuestionInput,
} from '../../../domain/quiz/QuestionRepository';
import { db } from '../LunaClairDatabase';

function generateId(): string {
    return `q-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export class DexieQuestionRepository implements QuestionRepository {
    async getQuestions(materialId: string, signal?: AbortSignal): Promise<Question[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return db.questions.where('materialId').equals(materialId).toArray();
    }

    async getQuestionById(id: string, signal?: AbortSignal): Promise<Question | null> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return (await db.questions.get(id)) ?? null;
    }

    async createQuestion(input: CreateQuestionInput): Promise<Question> {
        const now = new Date().toISOString();
        const question: Question = {
            id: generateId(),
            materialId: input.materialId,
            type: input.type,
            prompt: input.prompt,
            payload: input.payload,
            difficulty: input.difficulty ?? 'medium',
            points: input.points ?? 1,
            explanation: input.explanation,
            tags: input.tags,
            status: input.status ?? 'draft',
            version: 1,
            createdAt: now,
            updatedAt: now,
        };
        await db.questions.put(question);
        return question;
    }

    async updateQuestion(id: string, input: UpdateQuestionInput): Promise<Question> {
        const existing = await db.questions.get(id);
        if (!existing) throw new Error(`Question not found: ${id}`);

        const updated: Question = {
            ...existing,
            ...input,
            version: existing.version + 1,
            updatedAt: new Date().toISOString(),
        };
        await db.questions.put(updated);
        return updated;
    }

    async deleteQuestion(id: string): Promise<void> {
        await db.questions.delete(id);
    }
}

export const dexieQuestionRepository = new DexieQuestionRepository();
