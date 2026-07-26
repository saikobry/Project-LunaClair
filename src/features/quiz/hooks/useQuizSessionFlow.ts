import { useState, useCallback, useEffect, useRef } from 'react';
import type { Question } from '../../../domain/quiz/Question';
import type { QuizMode } from '../../../domain/quiz/QuizMode';
import type { QuizResult } from '../../../domain/quiz/AssessmentService';
import type { QuizFlowState, QuizLaunchRequest } from '../types/quizFeature.types';
import type { AnswerValue } from '../components/QuestionRenderer';
import { useQuizLoader } from './useQuizLoader';
import { useQuizProgress } from './useQuizProgress';
import { useQuizSubmission } from './useQuizSubmission';
import { useQuizPersistence } from './useQuizPersistence';

export interface QuizSessionFlow {
    flowState: QuizFlowState;
    questions: Question[];
    currentIndex: number;
    currentQuestion: Question | null;
    totalQuestions: number;
    answeredCount: number;
    isLastQuestion: boolean;
    mode: QuizMode;
    result: QuizResult | null;
    error: Error | null;
    answers: Map<string, AnswerValue>;
    setAnswer: (questionId: string, value: AnswerValue) => void;
    goNext: () => void;
    goPrev: () => void;
    submit: () => void;
    retake: () => void;
}

/**
 * Orchestrator hook composing modular sub-hooks into a clean QuizFlowState machine.
 * Manages the full lifecycle: load → session create → answer → submit → persist.
 */
export function useQuizSessionFlow(launchRequest: QuizLaunchRequest): QuizSessionFlow {
    const mode: QuizMode = launchRequest.mode ?? 'practice';
    const { quiz, questions, isLoading, isError, error } = useQuizLoader(
        launchRequest.materialId,
        launchRequest.quizId,
    );

    const progress = useQuizProgress(questions);
    const { evaluate } = useQuizSubmission();
    const { createSession, completeSession } = useQuizPersistence();

    const [flowState, setFlowState] = useState<QuizFlowState>('loading');
    const [result, setResult] = useState<QuizResult | null>(null);
    const sessionCreated = useRef(false);

    // Determine flow state from loading results
    useEffect(() => {
        if (isLoading) {
            setFlowState('loading');
        } else if (isError) {
            setFlowState('error');
        } else if (!quiz || questions.length === 0) {
            setFlowState('empty');
        } else {
            setFlowState('ready');
        }
    }, [isLoading, isError, quiz, questions.length]);

    // Create session when quiz becomes ready
    useEffect(() => {
        if (flowState === 'ready' && quiz && !sessionCreated.current) {
            sessionCreated.current = true;
            createSession(quiz.id, mode).catch(() => {
                setFlowState('error');
            });
        }
    }, [flowState, quiz, mode, createSession]);

    const submit = useCallback(() => {
        if (!quiz || questions.length === 0) return;

        const quizResult = evaluate(questions, progress.answers);
        setResult(quizResult);

        completeSession(quizResult.answers, quizResult.score)
            .then(() => setFlowState('completed'))
            .catch(() => setFlowState('error'));
    }, [quiz, questions, progress.answers, evaluate, completeSession]);

    const retake = useCallback(() => {
        setResult(null);
        progress.reset();
        sessionCreated.current = false;
        setFlowState('ready');
    }, [progress]);

    return {
        flowState,
        questions,
        currentIndex: progress.currentIndex,
        currentQuestion: progress.currentQuestion,
        totalQuestions: progress.totalQuestions,
        answeredCount: progress.answeredCount,
        isLastQuestion: progress.isLastQuestion,
        mode,
        result,
        error: error as Error | null,
        answers: progress.answers,
        setAnswer: progress.setAnswer,
        goNext: progress.goNext,
        goPrev: progress.goPrev,
        submit,
        retake,
    };
}
