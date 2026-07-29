import { useState, useCallback } from 'react';
import type { StudyMaterial } from '../../domain/library';
import type { QuizLaunchRequest } from '../quiz/types/quizFeature.types';
import { useLibrary } from './hooks/useLibrary';
import { useSubjects } from '../../shared/hooks/useSubjects';
import { useCreateMaterial } from './hooks/mutations/useCreateMaterial';
import { useDeleteMaterial } from './hooks/mutations/useDeleteMaterial';
import { useEditMaterial } from './hooks/mutations/useEditMaterial';
import LibraryView from './LibraryView';

interface LibraryScreenProps {
  onOpenMaterial: (materialId: string) => void;
  onOpenSubject: (subjectId: string) => void;
  onStartQuiz: (request: QuizLaunchRequest) => void;
  onManage: (materialId: string, subjectId?: string) => void;
}

export default function LibraryScreen({ onOpenMaterial, onOpenSubject, onStartQuiz, onManage }: LibraryScreenProps) {
  const { materials } = useLibrary();
  const { subjects } = useSubjects();
  const createMutation = useCreateMaterial();
  const deleteMutation = useDeleteMaterial();
  const editMutation = useEditMaterial();

  const [editTarget, setEditTarget] = useState<StudyMaterial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);

  const uncategorizedMaterials = materials.filter((m) => !m.subjectId);

  const handleNewMaterial = useCallback(() => {
    const title = `Study Material ${materials.length + 1}`;
    createMutation.mutate({ title });
  }, [materials.length, createMutation]);

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
    (title: string, description: string) => {
      if (!editTarget) return;
      editMutation.mutate({ id: editTarget.id, input: { title, description } });
      setEditTarget(null);
    },
    [editTarget, editMutation],
  );

  const handleEditClose = useCallback(() => {
    setEditTarget(null);
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
      onStartQuiz({ type: 'quiz', quizId: material.id, materialId: material.id, source: 'library', subjectId: material.subjectId });
    },
    [onStartQuiz],
  );

  return (
    <LibraryView
      subjects={subjects}
      materials={uncategorizedMaterials}
      allMaterials={materials}
      onNewMaterial={handleNewMaterial}
      onOpen={handleOpen}
      onOpenSubject={onOpenSubject}
      onEdit={handleEditTrigger}
      onDelete={handleDeleteTrigger}
      onStartQuiz={handleStartQuiz}
      onManage={(m) => onManage(m.id, m.subjectId)}
      editTarget={editTarget}
      deleteTarget={deleteTarget}
      onEditSave={handleEditSave}
      onEditClose={handleEditClose}
      onDeleteConfirm={handleDeleteConfirm}
      onDeleteClose={handleDeleteClose}
    />
  );
}
