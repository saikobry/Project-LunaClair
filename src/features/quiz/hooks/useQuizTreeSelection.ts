import { useState, useMemo, useCallback } from 'react';
import type { QuizTreeNodeTerm } from '../types/quizTree.types';
import type { SubjectQuizExplorerSelection } from '../../../shared/components/SubjectQuizExplorer/SubjectQuizExplorer';

/**
 * Manages selection state for the quiz tree view.
 * Accepts `terms: QuizTreeNodeTerm[]` and returns selection state,
 * toggle callbacks, and computed counters (total selected quizzes/questions).
 */
export function useQuizTreeSelection(terms: QuizTreeNodeTerm[]): SubjectQuizExplorerSelection {
    const [selectedQuizIds, setSelectedQuizIds] = useState<Set<string>>(new Set());

    // Build a map of quizId → questionIds for deduplicated counter lookups
    const quizQuestionIdsMap = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const term of terms) {
            for (const material of term.materials) {
                for (const quiz of material.quizzes) {
                    map.set(quiz.id, quiz.quiz.questionIds);
                }
            }
        }
        return map;
    }, [terms]);

    const totalSelectedQuizzes = useMemo(() => selectedQuizIds.size, [selectedQuizIds]);

    const totalSelectedQuestions = useMemo(
        () => {
            const seenQuestionIds = new Set<string>();
            for (const id of selectedQuizIds) {
                const questionIds = quizQuestionIdsMap.get(id) ?? [];
                for (const qId of questionIds) {
                    seenQuestionIds.add(qId);
                }
            }
            return seenQuestionIds.size;
        },
        [selectedQuizIds, quizQuestionIdsMap],
    );

    const toggleQuiz = useCallback((quizId: string) => {
        setSelectedQuizIds((prev) => {
            const next = new Set(prev);
            if (next.has(quizId)) {
                next.delete(quizId);
            } else {
                next.add(quizId);
            }
            return next;
        });
    }, []);

    const toggleMaterial = useCallback((_materialId: string, quizIds: string[]) => {
        setSelectedQuizIds((prev) => {
            const allSelected = quizIds.every((id) => prev.has(id));
            const next = new Set(prev);
            for (const id of quizIds) {
                if (allSelected) {
                    next.delete(id);
                } else {
                    next.add(id);
                }
            }
            return next;
        });
    }, []);

    const toggleTerm = useCallback((quizIds: string[]) => {
        setSelectedQuizIds((prev) => {
            const allSelected = quizIds.every((id) => prev.has(id));
            const next = new Set(prev);
            for (const id of quizIds) {
                if (allSelected) {
                    next.delete(id);
                } else {
                    next.add(id);
                }
            }
            return next;
        });
    }, []);

    const toggleAll = useCallback((allIds: string[]) => {
        setSelectedQuizIds((prev) => {
            const allSelected = allIds.every((id) => prev.has(id));
            const next = new Set(prev);
            for (const id of allIds) {
                if (allSelected) {
                    next.delete(id);
                } else {
                    next.add(id);
                }
            }
            return next;
        });
    }, []);

    return {
        selectedQuizIds,
        totalSelectedQuizzes,
        totalSelectedQuestions,
        toggleQuiz,
        toggleMaterial,
        toggleTerm,
        toggleAll,
    };
}
