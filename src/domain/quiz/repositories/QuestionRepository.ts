import type { Question, QuestionStatus } from '../models/Question';

export interface CreateQuestionInput {
    materialId: string;
    type: Question['type'];
    prompt: string;
    payload: Question['payload'];
    difficulty?: Question['difficulty'];
    points?: number;
    explanation?: string;
    tags?: string[];
    /** Provenance label captured at generation time. See `Question.sourceSection`. */
    sourceSection?: string;
    status?: QuestionStatus;
}

export interface UpdateQuestionInput {
    prompt?: string;
    payload?: Question['payload'];
    difficulty?: Question['difficulty'];
    points?: number;
    explanation?: string;
    tags?: string[];
    /**
     * Provenance label. A **three-state** field, and the states are told apart on this raw
     * value, before any normalizer runs, because "absent" and "present but blank" both
     * normalize to nothing and must not collapse:
     *
     * - **absent** (`undefined`) — leave the stored label alone. This is what a
     *   difficulty-only save (publish, archive, points) takes, so an unrelated edit can never
     *   erase provenance it never knew about.
     * - **present but blank** (`''`, `'   '`) — **clear** the label. This is how a caller
     *   states "this question has no known origin"; it is a deliberate act, not a default.
     * - **labelled** — replace the stored label.
     */
    sourceSection?: string;
    status?: QuestionStatus;
}

export interface QuestionRepository {
    getQuestions(materialId: string, signal?: AbortSignal): Promise<Question[]>;
    getQuestionById(id: string, signal?: AbortSignal): Promise<Question | null>;
    getQuestionsByIds(ids: string[], signal?: AbortSignal): Promise<Question[]>;
    createQuestion(input: CreateQuestionInput): Promise<Question>;
    createQuestionsBatch(inputs: CreateQuestionInput[]): Promise<Question[]>;
    updateQuestion(id: string, input: UpdateQuestionInput): Promise<Question>;
    deleteQuestion(id: string): Promise<void>;
}
