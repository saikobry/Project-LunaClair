import { useState, useCallback, useEffect, useRef } from 'react';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { QuizMode } from '../../../../domain/quiz/models/QuizMode';
import type { QuizResult } from '../../../../domain/quiz/services/AssessmentService';
import type { QuizFlowState, QuizLaunchRequest } from '../../types/quizFeature.types';
import type { AnswerValue } from '../../components/QuestionRenderer';
import { useQuizLoader } from './useQuizLoader';
import { useQuizProgress } from './useQuizProgress';
import { useQuizPersistence } from './useQuizPersistence';

export interface QuizSessionFlow {
    flowState: QuizFlowState;
    questions: Question[];
    /** The individual quizzes loaded from the repository. For unified quizzes, this is the source array before virtual merging. */
    sourceQuizzes: Quiz[];
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

interface FlowStateArgs {
    isCompleted: boolean;
    sessionError: Error | null;
    isLoading: boolean;
    isError: boolean;
    quiz: Quiz | null;
    questions: Question[];
}

/** Early-return derivation keeps flowState precedence readable and flat. */
function deriveFlowState({ isCompleted, sessionError, isLoading, isError, quiz, questions }: FlowStateArgs): QuizFlowState {
    if (isCompleted) return 'completed';
    if (sessionError) return 'error';
    if (isLoading) return 'loading';
    if (isError) return 'error';
    if (!quiz || questions.length === 0) return 'empty';
    return 'ready';
}

/**
 * Orchestrator hook composing modular sub-hooks into a clean QuizFlowState machine.
 * Consumes the discriminated QuizLaunchRequest union.
 * Manages the full lifecycle: load → session create → answer → submit → persist.
 */
export function useQuizSessionFlow(launchRequest: QuizLaunchRequest): QuizSessionFlow {
    const mode: QuizMode = launchRequest.mode ?? 'practice';
    const { quiz, sourceQuizzes, questions, isLoading, isError, error } = useQuizLoader(launchRequest);

    const progress = useQuizProgress(questions);
    const { createSession, completeSession } = useQuizPersistence();

    const [result, setResult] = useState<QuizResult | null>(null);
    const [sessionError, setSessionError] = useState<Error | null>(null);
    const [isCompleted, setIsCompleted] = useState(false);
    const sessionCreated = useRef(false);

    // ── Derive flowState from props during render ──
    // This replaces the old useEffect that adjusted state after prop changes.
    // Deriving during render means the correct value is available on the very
    // first render — no stale-frame flicker for the user.
    const flowState: QuizFlowState = deriveFlowState({
        isCompleted,
        sessionError,
        isLoading,
        isError,
        quiz,
        questions,
    });

    // Create session when quiz becomes ready
    useEffect(() => {
        if (flowState === 'ready' && quiz && !sessionCreated.current) {
            sessionCreated.current = true;

            const createPromise = launchRequest.type === 'quizzes'
                ? createSession({ source: 'virtual', quiz, mode })
                : createSession({ source: 'stored', quizId: quiz.id, mode });

            createPromise.catch((err) => {
                setSessionError(err instanceof Error ? err : new Error(String(err)));
            });
        }
    }, [flowState, quiz, mode, createSession, launchRequest]);

    const submit = useCallback(() => {
        if (!quiz || questions.length === 0) return;

        const submissions = questions.map((question) => ({
            questionId: question.id,
            value: progress.answers.get(question.id) ?? '',
        }));

        completeSession(submissions)
            .then(({ result: quizResult }) => {
                setResult(quizResult);
                setIsCompleted(true);
            })
            .catch((err) => {
                setSessionError(err instanceof Error ? err : new Error(String(err)));
            });
    }, [quiz, questions, progress.answers, completeSession]);

    const retake = useCallback(() => {
        setResult(null);
        setSessionError(null);
        setIsCompleted(false);
        progress.reset();
        sessionCreated.current = false;
    }, [progress]);

    return {
        flowState,
        questions,
        sourceQuizzes,
        currentIndex: progress.currentIndex,
        currentQuestion: progress.currentQuestion,
        totalQuestions: progress.totalQuestions,
        answeredCount: progress.answeredCount,
        isLastQuestion: progress.isLastQuestion,
        mode,
        result,
        error: (sessionError ?? error) as Error | null,
        answers: progress.answers,
        setAnswer: progress.setAnswer,
        goNext: progress.goNext,
        goPrev: progress.goPrev,
        submit,
        retake,
    };
}
