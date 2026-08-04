import { useState, useCallback } from 'react';
import type { StudyMaterial } from '../../../../domain/library';
import type { Subject } from '../../../../domain/library';
import type { QuizLaunchRequest } from '../../../quiz';
import { useSubjects } from '../../subjects/hooks/queries/useSubjects';
import { useCreateSubject } from '../../subjects/hooks/mutations/useCreateSubject';
import { useEditSubject } from '../../subjects/hooks/mutations/useEditSubject';
import { useDeleteSubject } from '../../subjects/hooks/mutations/useDeleteSubject';
import { useReorderSubjects } from '../../subjects/hooks/mutations/useReorderSubjects';
import { useLibrary } from '../hooks/queries/useLibrary';
import { useCreateMaterial } from '../hooks/mutations/useCreateMaterial';
import { useDeleteMaterial } from '../hooks/mutations/useDeleteMaterial';
import { useEditMaterial } from '../hooks/mutations/useEditMaterial';
import LibraryView from './LibraryView';

interface LibraryScreenProps {
  onOpenMaterial: (materialId: string) => void;
  onOpenSubject: (subjectId: string) => void;
  onStartQuiz: (request: QuizLaunchRequest) => void;
  onManage: (materialId: string, subjectId?: string) => void;
}

export default function LibraryScreen({ onOpenMaterial, onOpenSubject, onStartQuiz, onManage }: LibraryScreenProps) {
  const { materials, isLoading: materialsLoading } = useLibrary();
  const { subjects, isLoading: subjectsLoading } = useSubjects();
  const isLibraryLoading = materialsLoading || subjectsLoading;
  // Note: termsLoading is no longer tracked here since LibraryView
  // no longer consumes allTerms. Terms are resolved on demand via
  // SubjectTermRepository in EditMaterialModal.
  const createMutation = useCreateMaterial();
  const deleteMutation = useDeleteMaterial();
  const editMutation = useEditMaterial();
  const createSubjectMutation = useCreateSubject();
  const editSubjectMutation = useEditSubject();
  const deleteSubjectMutation = useDeleteSubject();
  const reorderSubjectsMutation = useReorderSubjects();

  const [editTarget, setEditTarget] = useState<StudyMaterial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);
  const [subjectEditTarget, setSubjectEditTarget] = useState<Subject | null>(null);
  const [subjectDeleteTarget, setSubjectDeleteTarget] = useState<Subject | null>(null);
  const [showCreateSubject, setShowCreateSubject] = useState(false);

  const uncategorizedMaterials = materials.filter((m) => !m.subjectId);

  const handleNewMaterial = useCallback(() => {
    const title = `Study Material ${materials.length + 1}`;
    createMutation.mutate({ title });
  }, [materials.length, createMutation]);

  const handleNewSubject = useCallback(() => {
    setShowCreateSubject(true);
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
    (title: string, description: string, subjectId?: string | null, termId?: string | null) => {
      if (!editTarget) return;
      editMutation.mutate({
        id: editTarget.id,
        input: { title, description, subjectId, termId },
      });
      setEditTarget(null);
    },
    [editTarget, editMutation],
  );

  const handleEditClose = useCallback(() => {
    setEditTarget(null);
  }, []);

  const handleCreateSubjectSave = useCallback(
    (title: string, description: string) => {
      createSubjectMutation.mutate({ title, description });
      setShowCreateSubject(false);
    },
    [createSubjectMutation],
  );

  const handleCreateSubjectClose = useCallback(() => {
    setShowCreateSubject(false);
  }, []);

  const handleSubjectEdit = useCallback((subject: Subject) => {
    setSubjectEditTarget(subject);
  }, []);

  const handleSubjectEditSave = useCallback(
    (title: string, description: string) => {
      if (!subjectEditTarget) return;
      editSubjectMutation.mutate({
        id: subjectEditTarget.id,
        input: { title, description },
      });
      setSubjectEditTarget(null);
    },
    [subjectEditTarget, editSubjectMutation],
  );

  const handleSubjectEditClose = useCallback(() => {
    setSubjectEditTarget(null);
  }, []);

  const handleSubjectDelete = useCallback((subject: Subject) => {
    setSubjectDeleteTarget(subject);
  }, []);

  const handleSubjectDeleteConfirm = useCallback(() => {
    if (!subjectDeleteTarget) return;
    deleteSubjectMutation.mutate(subjectDeleteTarget.id);
    setSubjectDeleteTarget(null);
  }, [subjectDeleteTarget, deleteSubjectMutation]);

  const handleSubjectDeleteClose = useCallback(() => {
    setSubjectDeleteTarget(null);
  }, []);

  const handleSubjectReorder = useCallback(
    (orderedIds: string[]) => {
      reorderSubjectsMutation.mutate({ orderedIds });
    },
    [reorderSubjectsMutation],
  );

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
      isLoading={isLibraryLoading}
      subjects={subjects}
      materials={uncategorizedMaterials}
      allMaterials={materials}
      onNewMaterial={handleNewMaterial}
      onNewSubject={handleNewSubject}
      onOpen={handleOpen}
      onOpenSubject={onOpenSubject}
      onEdit={handleEditTrigger}
      onDelete={handleDeleteTrigger}
      onStartQuiz={handleStartQuiz}
      onManage={(m) => onManage(m.id, m.subjectId)}
      editTarget={editTarget}
      deleteTarget={deleteTarget}
      subjectEditTarget={subjectEditTarget}
      subjectDeleteTarget={subjectDeleteTarget}
      showCreateSubject={showCreateSubject}
      isSavingReorder={reorderSubjectsMutation.isPending}
      onEditSave={handleEditSave}
      onEditClose={handleEditClose}
      onSubjectEdit={handleSubjectEdit}
      onSubjectDelete={handleSubjectDelete}
      onSubjectReorder={handleSubjectReorder}
      onSubjectEditSave={handleSubjectEditSave}
      onSubjectEditClose={handleSubjectEditClose}
      onSubjectDeleteConfirm={handleSubjectDeleteConfirm}
      onSubjectDeleteClose={handleSubjectDeleteClose}
      onCreateSubjectSave={handleCreateSubjectSave}
      onCreateSubjectClose={handleCreateSubjectClose}
      onDeleteConfirm={handleDeleteConfirm}
      onDeleteClose={handleDeleteClose}
    />
  );
}
