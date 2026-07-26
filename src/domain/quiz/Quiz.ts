export type QuizStatus = 'draft' | 'published' | 'archived';

export interface QuizQuestion {
    quizId: string;
    questionId: string;
    questionVersion: number;
    order: number;
    points?: number;
}

export interface Quiz {
    id: string;
    materialId: string;
    title: string;
    description?: string;
    questionIds: string[];
    items: QuizQuestion[];
    status: QuizStatus;
    timeLimitSeconds?: number;
    passingPercentage?: number;
    createdAt: string;
    updatedAt: string;
}
