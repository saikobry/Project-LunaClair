import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { collectionQueryKeys } from '../../queries/collectionQueryKeys';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { CollectionQuizMaterialGroup } from '../../types/collectionQuizTree.types';

/**
 * Query hook resolving all quizzes for a collection's materials,
 * grouped by material in the collection's material order.
 *
 * Reads via the `QuizRepository` port (`getQuizzesForMaterials`) through
 * DI context — never concrete infrastructure. `questionIds.length` gives
 * the question count directly.
 */
export function useCollectionQuizTree(collectionId: string, materials: StudyMaterial[]) {
  const context = useContextOrThrow(ApplicationContext, 'useCollectionQuizTree');
  const materialIds = materials.map((m) => m.id);

  const { data, isLoading } = useQuery({
    queryKey: [...collectionQueryKeys.materials(collectionId), 'quiz-tree'] as const,
    queryFn: async ({ signal }) => {
      if (materialIds.length === 0) return [];
      return context.repositories.quiz.getQuizzesForMaterials(materialIds, signal);
    },
    enabled: collectionId.length > 0,
  });

  const quizzes = data ?? [];
  const byMaterialId = new Map<string, typeof quizzes>();
  for (const quiz of quizzes) {
    const list = byMaterialId.get(quiz.materialId);
    if (list) {
      list.push(quiz);
    } else {
      byMaterialId.set(quiz.materialId, [quiz]);
    }
  }

  const tree: CollectionQuizMaterialGroup[] = materials.flatMap((material) => {
    const group = byMaterialId.get(material.id) ?? [];
    if (group.length === 0) return [];
    return [
      {
        materialId: material.id,
        materialTitle: material.title,
        quizzes: group.map((quiz) => ({
          id: quiz.id,
          materialId: quiz.materialId,
          title: quiz.title,
          questionCount: quiz.questionIds.length,
          description: quiz.description,
        })),
      },
    ];
  });

  return { tree, isLoading };
}
