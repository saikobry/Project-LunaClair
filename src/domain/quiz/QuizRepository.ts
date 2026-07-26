import type { Quiz } from './Quiz';

export interface CreateQuizInput {
    materialId: string;
    title: string;
    description?: string;
    questionIds: string[];
    timeLimitSeconds?: number;
    passingPercentage?: number;
}

export interface UpdateQuizInput {
    title?: string;
    description?: string;
    questionIds?: string[];
    timeLimitSeconds?: number;
    passingPercentage?: number;
}

export interface QuizRepository {
    getQuizzes(materialId: string, signal?: AbortSignal): Promise<Quiz[]>;
    getQuizById(id: string, signal?: AbortSignal): Promise<Quiz | null>;
    createQuiz(input: CreateQuizInput): Promise<Quiz>;
    updateQuiz(id: string, input: UpdateQuizInput): Promise<Quiz>;
    deleteQuiz(id: string): Promise<void>;
}
