import { useMemo } from 'react';
import type { Quiz } from '../../../domain/quiz/Quiz';
import type { Question } from '../../../domain/quiz/Question';
import { useQuizzes } from './useQuizzes';
import { useQuestions } from './useQuestions';

export interface QuizLoaderResult {
    quiz: Quiz | null;
    questions: Question[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
}

/**
 * Loads quiz definitions and questions for the requested material.
 * If a specific quizId is provided, selects that quiz; otherwise picks the first.
 */
export function useQuizLoader(materialId: string, quizId?: string): QuizLoaderResult {
    const { quizzes, isLoading: quizzesLoading, isError: quizzesError, error: quizzesErr } = useQuizzes(materialId);
    const { questions, isLoading: questionsLoading, isError: questionsError, error: questionsErr } = useQuestions(materialId);

    const quiz = useMemo(() => {
        if (quizzes.length === 0) return null;
        if (quizId) return quizzes.find((q) => q.id === quizId) ?? null;
        return quizzes[0];
    }, [quizzes, quizId]);

    const quizQuestions = useMemo(() => {
        if (!quiz) return [];
        const idSet = new Set(quiz.questionIds);
        return questions.filter((q) => idSet.has(q.id));
    }, [questions, quiz]);

    return {
        quiz,
        questions: quizQuestions,
        isLoading: quizzesLoading || questionsLoading,
        isError: quizzesError || questionsError,
        error: (quizzesErr ?? questionsErr) as Error | null,
    };
}
