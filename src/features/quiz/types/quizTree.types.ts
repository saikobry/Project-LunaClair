import type { Quiz } from '../../../domain/quiz/Quiz';

export interface QuizTreeNodeQuiz {
    id: string;
    title: string;
    materialId: string;
    questionCount: number;
    quiz: Quiz;
}

export interface QuizTreeNodeMaterial {
    id: string;
    title: string;
    termId?: string;
    quizzes: QuizTreeNodeQuiz[];
}

export interface QuizTreeNodeTerm {
    id: string;
    title: string;
    order: number;
    materials: QuizTreeNodeMaterial[];
}
