import type { Quiz, QuizStatus, QuizQuestion } from './Quiz';

export interface CreateQuizInput {
    materialId: string;
    title: string;
    description?: string;
    questionIds: string[];
    items?: QuizQuestion[];
    status?: QuizStatus;
    timeLimitSeconds?: number;
    passingPercentage?: number;
}

export interface UpdateQuizInput {
    title?: string;
    description?: string;
    questionIds?: string[];
    items?: QuizQuestion[];
    status?: QuizStatus;
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
