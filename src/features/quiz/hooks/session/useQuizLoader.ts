import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { QuizLaunchRequest } from '../../types/quizFeature.types';
import { createVirtualQuizFromQuizzes } from '../../../../domain/quiz/factories/virtualQuiz';
import { useQuizRepository } from '../repositories/useQuizRepository';
import { useQuestionRepository } from '../repositories/useQuestionRepository';
import { assessmentQueryKeys } from '../../queries/assessmentQueryKeys';

export interface QuizLoaderResult {
    quiz: Quiz | null;
    /** The individual quizzes loaded from the repository (for unified quizzes, this is the source array before virtual merging). */
    sourceQuizzes: Quiz[];
    questions: Question[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
}

/**
 * Cache-first quiz loader that resolves QuizLaunchRequest.
 *
 * Resolution rules:
 * - { type: 'quiz', quizId } → load single quiz by ID, then its questions
 * - { type: 'quizzes', quizIds } → load quizzes by IDs, then deduplicate questions via createVirtualQuizFromQuizzes
 *
 * Cache-First: React Query Cache → Repository fallback (automatic via useQuery).
 */
export function useQuizLoader(launchRequest: QuizLaunchRequest): QuizLoaderResult {
    const quizRepository = useQuizRepository();
    const questionRepository = useQuestionRepository();

    const requestType = launchRequest.type;
    const singleQuizId = launchRequest.type === 'quiz' ? launchRequest.quizId : undefined;
    const materialId = launchRequest.type === 'quiz' ? launchRequest.materialId : undefined;
    const isByMaterial = launchRequest.type === 'quiz' && Boolean(materialId);

    const rawQuizIdsKey = isByMaterial
        ? materialId!
        : launchRequest.type === 'quizzes'
          ? launchRequest.quizIds.join('|')
          : singleQuizId ?? '';

    // Load quizzes (by materialId if available, or by IDs)
    const {
        data: quizzes = [],
        isLoading: quizzesLoading,
        isError: quizzesError,
        error: quizzesErr,
    } = useQuery({
        queryKey: isByMaterial
            ? assessmentQueryKeys.quizzes(materialId!)
            : [...assessmentQueryKeys.all, 'quizzes-by-ids', rawQuizIdsKey],
        queryFn: ({ signal }) => {
            if (isByMaterial) {
                return quizRepository.getQuizzes(materialId!, signal);
            }
            const ids = launchRequest.type === 'quizzes' ? launchRequest.quizIds : singleQuizId ? [singleQuizId] : [];
            return quizRepository.getQuizzesByIds(ids, signal);
        },
        enabled: isByMaterial ? Boolean(materialId) : rawQuizIdsKey.length > 0,
    });

    // Derive all unique question IDs from resolved quizzes
    const allQuestionIds = useMemo(() => {
        const seen = new Set<string>();
        for (const q of quizzes) {
            for (const qId of q.questionIds) {
                seen.add(qId);
            }
        }
        return Array.from(seen);
    }, [quizzes]);

    // Load all questions by IDs (cache-first)
    const {
        data: questions = [],
        isLoading: questionsLoading,
        isError: questionsError,
        error: questionsErr,
    } = useQuery({
        queryKey: [...assessmentQueryKeys.all, 'questions-by-ids', ...allQuestionIds.sort()],
        queryFn: ({ signal }) => questionRepository.getQuestionsByIds(allQuestionIds, signal),
        enabled: allQuestionIds.length > 0,
    });

    // Filter out archived quizzes for default resolution
    const activeQuizzes = useMemo(
        () => quizzes.filter((q) => q.status !== 'archived'),
        [quizzes],
    );

    // Build the resolved quiz (single or virtual)
    const quiz = useMemo((): Quiz | null => {
        if (activeQuizzes.length === 0) return null;

        if (requestType === 'quiz') {
            if (singleQuizId) {
                return activeQuizzes.find((q) => q.id === singleQuizId) ?? null;
            }
            return activeQuizzes[0] ?? null;
        }

        // Multi-quiz mode: synthesize a virtual quiz
        const targetQuizIds = launchRequest.type === 'quizzes' ? launchRequest.quizIds : [];
        return createVirtualQuizFromQuizzes({
            quizIds: targetQuizIds,
            quizzes,
            questions,
        });
    }, [activeQuizzes, quizzes, questions, requestType, singleQuizId, launchRequest]);

    // Filter questions relevant to the resolved quiz, ordered by items[].order
    const quizQuestions = useMemo(() => {
        if (!quiz) return [];
        const idSet = new Set(quiz.questionIds);
        const filtered = questions.filter((q) => idSet.has(q.id));

        // Build order map from quiz.items (fall back to questionIds index)
        const orderMap = new Map<string, number>();
        const items = quiz.items ?? [];
        if (items.length > 0) {
            for (const item of items) {
                orderMap.set(item.questionId, item.order);
            }
        } else {
            quiz.questionIds.forEach((qId, idx) => {
                orderMap.set(qId, idx + 1);
            });
        }

        return filtered.toSorted(
            (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
        );
    }, [questions, quiz]);

    return {
        quiz,
        sourceQuizzes: activeQuizzes,
        questions: quizQuestions,
        isLoading: quizzesLoading || questionsLoading,
        isError: quizzesError || questionsError,
        error: (quizzesErr ?? questionsErr) as Error | null,
    };
}
