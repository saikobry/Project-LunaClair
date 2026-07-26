import { useState, useCallback } from 'react';
import type { StudyMaterial } from '../../domain/library';
import type { QuizLaunchRequest } from '../quiz/types/quizFeature.types';
import { useLibrary } from './hooks/useLibrary';
import { useCreateMaterial } from './hooks/mutations/useCreateMaterial';
import { useDeleteMaterial } from './hooks/mutations/useDeleteMaterial';
import { useRenameMaterial } from './hooks/mutations/useRenameMaterial';
import LibraryView from './LibraryView';

interface LibraryScreenProps {
  onOpenMaterial: (material: StudyMaterial) => void;
  onStartQuiz: (request: QuizLaunchRequest) => void;
}

export default function LibraryScreen({ onOpenMaterial, onStartQuiz }: LibraryScreenProps) {
  const { materials } = useLibrary();
  const createMutation = useCreateMaterial();
  const deleteMutation = useDeleteMaterial();
  const renameMutation = useRenameMaterial();

  const [renameTarget, setRenameTarget] = useState<StudyMaterial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);

  const handleNewMaterial = useCallback(() => {
    const title = `Study Material ${materials.length + 1}`;
    createMutation.mutate({ title });
  }, [materials.length, createMutation]);

  const handleOpen = useCallback(
    (material: StudyMaterial) => {
      onOpenMaterial(material);
    },
    [onOpenMaterial],
  );

  const handleRenameTrigger = useCallback((material: StudyMaterial) => {
    setRenameTarget(material);
  }, []);

  const handleRenameSave = useCallback(
    (title: string, description: string) => {
      if (!renameTarget) return;
      renameMutation.mutate({ id: renameTarget.id, input: { title, description } });
      setRenameTarget(null);
    },
    [renameTarget, renameMutation],
  );

  const handleRenameClose = useCallback(() => {
    setRenameTarget(null);
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
      onStartQuiz({ materialId: material.id, source: 'library' });
    },
    [onStartQuiz],
  );

  return (
    <LibraryView
      materials={materials}
      onNewMaterial={handleNewMaterial}
      onOpen={handleOpen}
      onRename={handleRenameTrigger}
      onDelete={handleDeleteTrigger}
      onStartQuiz={handleStartQuiz}
      renameTarget={renameTarget}
      deleteTarget={deleteTarget}
      onRenameSave={handleRenameSave}
      onRenameClose={handleRenameClose}
      onDeleteConfirm={handleDeleteConfirm}
      onDeleteClose={handleDeleteClose}
    />
  );
}
