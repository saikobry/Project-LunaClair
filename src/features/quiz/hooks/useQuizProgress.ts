import { useState, useCallback, useMemo } from 'react';
import type { Question } from '../../../domain/quiz/Question';
import type { AnswerValue } from '../components/QuestionRenderer';

export interface QuizProgressState {
    currentIndex: number;
    currentQuestion: Question | null;
    answers: Map<string, AnswerValue>;
    totalQuestions: number;
    answeredCount: number;
    isLastQuestion: boolean;
}

export interface QuizProgressActions {
    setAnswer: (questionId: string, value: AnswerValue) => void;
    goNext: () => void;
    goPrev: () => void;
    goTo: (index: number) => void;
    reset: () => void;
}

/**
 * Manages current question index, draft answers map, and navigation.
 */
export function useQuizProgress(questions: Question[]): QuizProgressState & QuizProgressActions {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Map<string, AnswerValue>>(() => new Map());

    const currentQuestion = questions[currentIndex] ?? null;

    const setAnswer = useCallback((questionId: string, value: AnswerValue) => {
        setAnswers((prev) => {
            const next = new Map(prev);
            next.set(questionId, value);
            return next;
        });
    }, []);

    const goNext = useCallback(() => {
        setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
    }, [questions.length]);

    const goPrev = useCallback(() => {
        setCurrentIndex((i) => Math.max(i - 1, 0));
    }, []);

    const goTo = useCallback((index: number) => {
        setCurrentIndex(Math.max(0, Math.min(index, questions.length - 1)));
    }, [questions.length]);

    const reset = useCallback(() => {
        setCurrentIndex(0);
        setAnswers(new Map());
    }, []);

    const answeredCount = useMemo(() => answers.size, [answers]);

    return {
        currentIndex,
        currentQuestion,
        answers,
        totalQuestions: questions.length,
        answeredCount,
        isLastQuestion: currentIndex === questions.length - 1,
        setAnswer,
        goNext,
        goPrev,
        goTo,
        reset,
    };
}
