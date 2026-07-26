import type { QuestionType } from './QuestionType';
import type { QuestionAnswerPayload } from './AnswerPayload';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface Question {
    id: string;
    materialId: string;
    type: QuestionType;
    prompt: string;
    payload: QuestionAnswerPayload;
    difficulty: QuestionDifficulty;
    points: number;
    explanation?: string;
    tags?: string[];
    version: number;
    createdAt: string;
    updatedAt: string;
}
