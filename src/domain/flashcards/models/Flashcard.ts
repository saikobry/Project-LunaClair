import type { QuestionType } from '../../quiz/models/QuestionType';

export type FlashcardType = QuestionType;

export type FlashcardSource = { type: 'question'; questionId: string };

export interface Flashcard {
    key: string; // `q:${questionId}`
    source: FlashcardSource;
    type: FlashcardType;
    front: string; // prompt / sentence template
    back: string; // rendered correct answer text
    explanation?: string;
    materialId: string;
    tags?: string[];
    difficulty: 'easy' | 'medium' | 'hard';
}
