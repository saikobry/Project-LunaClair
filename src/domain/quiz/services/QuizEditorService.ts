import type { QuestionDifficulty } from '../models/Question';
import type { QuestionType } from '../models/QuestionType';
import type { QuestionAnswerPayload } from '../models/AnswerPayload';
import type { Quiz } from '../models/Quiz';

/**
 * A single question mutation that is part of an atomic quiz save.
 *
 * `tempId` correlates a change with a canvas card (`QuizDraft` item), so
 * the service can resolve the final question id (existing or created)
 * inside the transaction.
 */
export type QuizEditorQuestionChange =
    | {
        kind: 'update';
        tempId: string;
        questionId: string;
        prompt: string;
        payload: QuestionAnswerPayload;
        /** When true the question version increments (content changed). */
        bumpVersion: boolean;
        difficulty?: QuestionDifficulty;
        explanation?: string;
        tags?: string[];
    }
    | {
        kind: 'create';
        tempId: string;
        materialId: string;
        type: QuestionType;
        prompt: string;
        payload: QuestionAnswerPayload;
        points: number;
        difficulty?: QuestionDifficulty;
        explanation?: string;
        tags?: string[];
    };

/** Atomic save intent: quiz metadata plus the question changes it carries. */
export interface SaveQuizToRepositoryInput {
    materialId: string;
    quiz: {
        /** Present when updating an existing quiz; absent when creating. */
        id?: string;
        title: string;
        description?: string;
        passingPercentage?: number;
        /** Quiz items keyed by canvas `tempId`; ids/versions resolved in-transaction. */
        items: Array<{ tempId: string; order: number; points?: number }>;
    };
    questionChanges: QuizEditorQuestionChange[];
}

export interface SaveQuizToRepositoryResult {
    quiz: Quiz;
    /** Ids of existing bank questions whose content/version changed. */
    updatedQuestionIds: string[];
}

/**
 * Application service contract for atomic quiz authoring saves.
 *
 * Implementations must persist all question changes and the quiz record
 * within a single database transaction so a failure can never leave the
 * catalog and the question bank out of sync.
 */
export interface QuizEditorService {
    saveQuiz(input: SaveQuizToRepositoryInput): Promise<SaveQuizToRepositoryResult>;
}
