import { useState, useCallback } from 'react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { QuizLaunchRequest } from '../../../features/quiz/types/quizFeature.types';
import { useLibrary } from '../../../features/materials/hooks/queries/useLibrary';
import { useCreateMaterial } from '../../../features/materials/hooks/mutations/useCreateMaterial';
import { useDeleteMaterial } from '../../../features/materials/hooks/mutations/useDeleteMaterial';
import { useEditMaterial } from '../../../features/materials/hooks/mutations/useEditMaterial';
import LibraryView from '../../../features/materials/components/LibraryView';
import LibraryModals from './LibraryModals';

export interface LibraryHomeScreenProps {
  onOpenMaterial: (materialId: string) => void;
  onStartQuiz: (request: QuizLaunchRequest) => void;
  onManage: (materialId: string) => void;
  onBrowseAvailable: () => void;
}

export function LibraryHomeScreen({
  onOpenMaterial,
  onStartQuiz,
  onManage,
  onBrowseAvailable,
}: LibraryHomeScreenProps) {
  const { materials, isLoading: materialsLoading } = useLibrary();

  const createMutation = useCreateMaterial();
  const deleteMutation = useDeleteMaterial();
  const editMutation = useEditMaterial();

  const [editTarget, setEditTarget] = useState<StudyMaterial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);
  const [showCreateMaterial, setShowCreateMaterial] = useState(false);
  const [managingCollectionsMaterial, setManagingCollectionsMaterial] = useState<StudyMaterial | null>(null);

  const handleNewMaterial = useCallback(() => {
    setShowCreateMaterial(true);
  }, []);

  const handleOpen = useCallback(
    (material: StudyMaterial) => {
      onOpenMaterial(material.id);
    },
    [onOpenMaterial],
  );

  const handleEditTrigger = useCallback((material: StudyMaterial) => {
    setEditTarget(material);
  }, []);

  const handleEditSave = useCallback(
    (title: string, description: string, tags?: string[]) => {
      if (!editTarget) return;
      editMutation.mutate({
        id: editTarget.id,
        input: { title, description, tags },
      });
      setEditTarget(null);
    },
    [editTarget, editMutation],
  );

  const handleEditClose = useCallback(() => {
    setEditTarget(null);
  }, []);

  const handleCreateMaterialSave = useCallback(
    (title: string, description: string, tags?: string[]) => {
      createMutation.mutate({ title, description, tags });
      setShowCreateMaterial(false);
    },
    [createMutation],
  );

  const handleCreateMaterialClose = useCallback(() => {
    setShowCreateMaterial(false);
  }, []);

  const handleDeleteTrigger = useCallback((material: StudyMaterial) => {
    setDeleteTarget(material);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteMutation]);

  const handleDeleteClose = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleStartQuiz = useCallback(
    (material: StudyMaterial) => {
      onStartQuiz({ type: 'quiz', quizId: material.id, materialId: material.id, source: 'library' });
    },
    [onStartQuiz],
  );

  const handleManageCollections = useCallback((material: StudyMaterial) => {
    setManagingCollectionsMaterial(material);
  }, []);

  const handleCloseManageCollections = useCallback(() => {
    setManagingCollectionsMaterial(null);
  }, []);

  return (
    <>
      <LibraryView
        isLoading={materialsLoading}
        materials={materials}
        onNewMaterial={handleNewMaterial}
        onOpen={handleOpen}
        onEdit={handleEditTrigger}
        onDelete={handleDeleteTrigger}
        onStartQuiz={handleStartQuiz}
        onManage={(m) => onManage(m.id)}
        onManageCollections={handleManageCollections}
        onBrowseAvailable={onBrowseAvailable}
      />
      <LibraryModals
        editTarget={editTarget}
        deleteTarget={deleteTarget}
        showCreateMaterial={showCreateMaterial}
        onEditSave={handleEditSave}
        onEditClose={handleEditClose}
        onCreateMaterialSave={handleCreateMaterialSave}
        onCreateMaterialClose={handleCreateMaterialClose}
        onDeleteConfirm={handleDeleteConfirm}
        onDeleteClose={handleDeleteClose}
        managingCollectionsMaterial={managingCollectionsMaterial}
        onCloseManageCollections={handleCloseManageCollections}
      />
    </>
  );
}

export default LibraryHomeScreen;
