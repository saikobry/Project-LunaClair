import type { Question } from '../../../domain/quiz/models/Question';
import type { Quiz, QuizQuestion } from '../../../domain/quiz/models/Quiz';
import type {
    QuizEditorService,
    SaveQuizToRepositoryInput,
    SaveQuizToRepositoryResult,
} from '../../../domain/quiz/services/QuizEditorService';
import { normalizeTags } from '../../../domain/quiz/utils/tags';
import { db as defaultDb, type LunaClairDatabase } from '../schema/LunaClairDatabase';

function generateQuestionId(): string {
    return `q-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function generateQuizId(): string {
    return `quiz-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Concrete `QuizEditorService` implementation backed by Dexie.
 *
 * `saveQuiz` persists every question change and the quiz record inside a
 * single `db.transaction('rw')` spanning the `questions` and `quizzes`
 * stores, so a failure can never leave the Quiz Catalog and the Question
 * Bank out of sync. Mirrors the `TermService` pattern for atomic
 * multi-entity workflows.
 *
 * Version increment rule: `bumpVersion` changes update the bank question
 * and increment `version`; metadata-only changes keep the version pinned.
 */
export class DexieQuizEditorService implements QuizEditorService {
    private readonly db: LunaClairDatabase;

    constructor(db: LunaClairDatabase = defaultDb) {
        this.db = db;
    }

    async saveQuiz(input: SaveQuizToRepositoryInput): Promise<SaveQuizToRepositoryResult> {
        return this.db.transaction('rw', [this.db.questions, this.db.quizzes], async () => {
            const now = new Date().toISOString();
            const resolvedIds = new Map<string, string>();
            const updatedQuestionIds: string[] = [];

            const changeResults = await Promise.all(
                input.questionChanges.map(async (change) => {
                    if (change.kind === 'create') {
                        const question: Question = {
                            id: generateQuestionId(),
                            materialId: change.materialId,
                            type: change.type,
                            prompt: change.prompt,
                            payload: change.payload,
                            difficulty: change.difficulty ?? 'medium',
                            points: change.points,
                            explanation: change.explanation,
                            tags: normalizeTags(change.tags),
                            status: 'draft',
                            version: 1,
                            createdAt: now,
                            updatedAt: now,
                        };
                        await this.db.questions.put(question);
                        return { tempId: change.tempId, resolvedId: question.id, bumpVersion: false };
                    }

                    const existing = await this.db.questions.get(change.questionId);
                    if (!existing) {
                        throw new Error(`Question not found: ${change.questionId}`);
                    }
                    const updated: Question = {
                        ...existing,
                        prompt: change.prompt,
                        payload: change.payload,
                        difficulty: change.difficulty ?? existing.difficulty,
                        explanation: change.explanation,
                        tags: normalizeTags(change.tags ?? existing.tags),
                        version: change.bumpVersion ? existing.version + 1 : existing.version,
                        updatedAt: now,
                    };
                    await this.db.questions.put(updated);
                    return { tempId: change.tempId, resolvedId: existing.id, bumpVersion: change.bumpVersion };
                }),
            );

            for (const result of changeResults) {
                resolvedIds.set(result.tempId, result.resolvedId);
                if (result.bumpVersion) updatedQuestionIds.push(result.resolvedId);
            }

            const questionIds = input.quiz.items.map((item) => {
                const resolved = resolvedIds.get(item.tempId);
                if (!resolved) throw new Error(`Unresolved canvas card: ${item.tempId}`);
                return resolved;
            });

            const items: QuizQuestion[] = input.quiz.items.map((item) => {
                const resolved = resolvedIds.get(item.tempId);
                if (!resolved) throw new Error(`Unresolved canvas card: ${item.tempId}`);
                return {
                    quizId: input.quiz.id ?? '',
                    questionId: resolved,
                    // Version snapshot is filled in below from the persisted records.
                    questionVersion: 0,
                    order: item.order,
                    points: item.points,
                };
            });

            let quiz: Quiz;
            if (input.quiz.id) {
                const existingQuiz = await this.db.quizzes.get(input.quiz.id);
                if (!existingQuiz) throw new Error(`Quiz not found: ${input.quiz.id}`);
                quiz = {
                    ...existingQuiz,
                    title: input.quiz.title,
                    description: input.quiz.description,
                    passingPercentage: input.quiz.passingPercentage ?? existingQuiz.passingPercentage,
                    questionIds,
                    items: items.map((item) => ({ ...item, quizId: existingQuiz.id })),
                    updatedAt: now,
                };
            } else {
                const id = generateQuizId();
                quiz = {
                    id,
                    materialId: input.materialId,
                    title: input.quiz.title,
                    description: input.quiz.description,
                    questionIds,
                    items: items.map((item) => ({ ...item, quizId: id })),
                    status: 'draft',
                    passingPercentage: input.quiz.passingPercentage,
                    createdAt: now,
                    updatedAt: now,
                };
            }

            // Snapshot the current version of each question into the quiz items.
            const persisted = await this.db.questions.where('id').anyOf(questionIds).toArray();
            const versionById = new Map(persisted.map((q) => [q.id, q.version]));
            quiz = {
                ...quiz,
                items: quiz.items.map((item) => ({
                    ...item,
                    questionVersion: versionById.get(item.questionId) ?? 1,
                })),
            };

            await this.db.quizzes.put(quiz);
            return { quiz, updatedQuestionIds };
        });
    }
}

export const dexieQuizEditorService = new DexieQuizEditorService();
