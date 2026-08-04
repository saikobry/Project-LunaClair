import type { Question, QuestionDifficulty } from '../../../domain/quiz/Question';
import type { Quiz } from '../../../domain/quiz/Quiz';
import type { QuestionType } from '../../../domain/quiz/QuestionType';
import type { QuestionAnswerPayload } from '../../../domain/quiz/AnswerPayload';

/**
 * Application Session DTOs for the quiz canvas authoring workflow.
 *
 * `QuizDraft` and `QuestionDraft` describe an in-progress authoring session:
 * they carry UI session concerns (`tempId` keys, `isDirty`) and are never
 * persisted to the Question Bank or Quiz Catalog. They exist only in
 * memory and inside the Dexie `quizEditingDrafts` crash-recovery store.
 */

/** A single question being authored on the canvas. */
export interface QuestionDraft {
    /** Stable key for React lists, drag reordering, and card focus. */
    tempId: string;
    /** Set when the card is backed by an existing Question Bank entity. */
    questionId?: string;
    type: QuestionType;
    prompt: string;
    payload: QuestionAnswerPayload;
    /** Quiz-scoped points (stored on `QuizQuestion.points`). */
    points: number;
    difficulty: QuestionDifficulty;
    explanation?: string;
    tags?: string[];
}

/** The full authoring session state for one quiz. */
export interface QuizDraft {
    /** Stable session id used as the `quizEditingDrafts` primary key. */
    draftId: string;
    /** Set once the quiz exists in the catalog (editing an existing quiz). */
    quizId?: string;
    materialId: string;
    title: string;
    description?: string;
    passingPercentage: number;
    items: QuestionDraft[];
    updatedAt: string;
    isDirty: boolean;
}

let tempCounter = 0;

/** Generates a stable, collision-resistant `tempId` for a canvas card. */
export function makeDraftTempId(): string {
    tempCounter += 1;
    return `card-${Date.now().toString(36)}-${tempCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Generates a stable `draftId` for a new authoring session. */
export function makeDraftId(): string {
    return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Creates a fresh empty quiz draft (optionally bound to an existing quiz). */
export function createEmptyQuizDraft(materialId: string, quizId?: string): QuizDraft {
    return {
        draftId: makeDraftId(),
        quizId,
        materialId,
        title: '',
        passingPercentage: 70,
        items: [],
        updatedAt: new Date().toISOString(),
        isDirty: false,
    };
}

/**
 * Seeds an authoring draft from an existing catalog quiz.
 *
 * Items follow the quiz's persisted order and reference their Question
 * Bank entities via `questionId`, so edits save back to the bank.
 */
export function createQuizDraftFromQuiz(quiz: Quiz, questions: Question[]): QuizDraft {
    const byId = new Map(questions.map((question) => [question.id, question]));
    const orderedItems = [...quiz.items].toSorted((a, b) => a.order - b.order);
    return {
        draftId: makeDraftId(),
        quizId: quiz.id,
        materialId: quiz.materialId,
        title: quiz.title,
        description: quiz.description,
        passingPercentage: quiz.passingPercentage ?? 70,
        items: orderedItems.flatMap((entry) => {
            const question = byId.get(entry.questionId);
            if (!question) return [];
            return [{
                tempId: makeDraftTempId(),
                questionId: question.id,
                type: question.type,
                prompt: question.prompt,
                payload: question.payload,
                points: entry.points ?? question.points,
                difficulty: question.difficulty,
                explanation: question.explanation,
                tags: question.tags,
            }];
        }),
        updatedAt: new Date().toISOString(),
        isDirty: false,
    };
}
