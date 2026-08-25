import type { Question, QuestionStatus } from './Question';

export interface CreateQuestionInput {
    materialId: string;
    type: Question['type'];
    prompt: string;
    payload: Question['payload'];
    difficulty?: Question['difficulty'];
    points?: number;
    explanation?: string;
    tags?: string[];
    status?: QuestionStatus;
}

export interface UpdateQuestionInput {
    prompt?: string;
    payload?: Question['payload'];
    difficulty?: Question['difficulty'];
    points?: number;
    explanation?: string;
    tags?: string[];
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
