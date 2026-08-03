import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Quiz } from '../../../domain/quiz/Quiz';
import type { QuizTreeNodeTerm, QuizTreeNodeMaterial, QuizTreeNodeQuiz } from '../types/quizTree.types';
import { useLibrary } from '../../../shared/hooks/useLibrary';
import { useTerms } from '../../../shared/hooks/useTerms';
import { useQuizRepository } from './useQuizRepository';
import { assessmentQueryKeys } from '../queries/assessmentQueryKeys';

/**
 * Data-fetching hook that constructs a Term → Material → Quiz tree model
 * for the Subject Quiz explorer. Exposes `terms`, `isLoading`, and `getQuizById`.
 *
 * Does NOT manage selection state — use `useQuizTreeSelection` for that.
 */
export function useSubjectQuizTree(subjectId: string) {
    const { materials: allMaterials, isLoading: materialsLoading } = useLibrary();
    const { terms, isLoading: termsLoading } = useTerms(subjectId);
    const quizRepository = useQuizRepository();

    // Filter materials belonging to this subject
    const subjectMaterials = useMemo(
        () => allMaterials.filter((m) => m.subjectId === subjectId),
        [allMaterials, subjectId],
    );

    const materialIds = useMemo(
        () => subjectMaterials.map((m) => m.id),
        [subjectMaterials],
    );

    // Fetch all quizzes for the subject's materials
    const {
        data: quizzes = [],
        isLoading: quizzesLoading,
    } = useQuery({
        queryKey: [...assessmentQueryKeys.root, 'subject-quizzes', subjectId],
        queryFn: ({ signal }) => quizRepository.getQuizzesForMaterials(materialIds, signal),
        enabled: materialIds.length > 0,
    });

    // Build a map of materialId → Quiz[] for fast lookup
    const quizzesByMaterialId = useMemo(() => {
        const map = new Map<string, Quiz[]>();
        for (const quiz of quizzes) {
            const existing = map.get(quiz.materialId);
            if (existing) {
                existing.push(quiz);
            } else {
                map.set(quiz.materialId, [quiz]);
            }
        }
        return map;
    }, [quizzes]);

    // Build the tree
    const tree = useMemo((): QuizTreeNodeTerm[] => {
        // Terms from useTerms(subjectId) are already sorted by SubjectTerm.order
        const grouped = new Map<string, QuizTreeNodeMaterial[]>();

        for (const material of subjectMaterials) {
            const materialQuizzes = (quizzesByMaterialId.get(material.id) ?? [])
                .filter((q) => q.status !== 'archived');
            const quizNodes: QuizTreeNodeQuiz[] = materialQuizzes.map((q) => ({
                id: q.id,
                title: q.title,
                materialId: q.materialId,
                questionCount: q.questionIds.length,
                quiz: q,
            }));

            const materialNode: QuizTreeNodeMaterial = {
                id: material.id,
                title: material.title,
                termId: material.termId,
                quizzes: quizNodes,
            };

            const termId = material.termId ?? '__unassigned__';
            const existing = grouped.get(termId);
            if (existing) {
                existing.push(materialNode);
            } else {
                grouped.set(termId, [materialNode]);
            }
        }

        const treeNodes: QuizTreeNodeTerm[] = [];

        // Add sorted terms (useTerms already returns them in SubjectTerm.order)
        terms.forEach((term, index) => {
            const materials = grouped.get(term.id);
            if (materials && materials.length > 0) {
                treeNodes.push({
                    id: term.id,
                    title: term.title,
                    order: index + 1,
                    materials,
                });
            }
        });

        // Add unassigned materials last
        const unassigned = grouped.get('__unassigned__');
        if (unassigned && unassigned.length > 0) {
            treeNodes.push({
                id: '__unassigned__',
                title: 'Unassigned',
                order: 999,
                materials: unassigned,
            });
        }

        return treeNodes;
    }, [subjectMaterials, terms, quizzesByMaterialId]);

    // Fast lookup helper
    const getQuizById = useMemo(
        () => (id: string): Quiz | undefined => quizzes.find((q) => q.id === id),
        [quizzes],
    );

    return {
        terms: tree,
        isLoading: materialsLoading || termsLoading || quizzesLoading,
        getQuizById,
        totalQuizzes: quizzes.length,
    };
}
