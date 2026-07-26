import type { Question } from './Question';
import type { QuizMode } from './QuizMode';
import type { SubmittedAnswer } from './Answer';

export interface QuizScore {
    correctAnswers: number;
    incorrectAnswers: number;
    earnedPoints: number;
    maxPoints: number;
    percentage: number;
}

export type QuizSessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface QuizSession {
    id: string;
    quizId: string;
    mode: QuizMode;
    status: QuizSessionStatus;
    /** Immutable snapshot of all questions at the moment the session was created. */
    questionSnapshots: Record<string, Question>;
    answers: SubmittedAnswer[];
    score?: QuizScore;
    startedAt: string;
    completedAt?: string;
}
