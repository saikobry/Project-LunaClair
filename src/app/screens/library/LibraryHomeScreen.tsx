import { useState, useCallback } from 'react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { Subject } from '../../../domain/library/models/Subject';
import type { QuizLaunchRequest } from '../../../features/quiz/types/quizFeature.types';
import { useSubjects } from '../../../features/subjects/hooks/queries/useSubjects';
import { useCreateSubject } from '../../../features/subjects/hooks/mutations/useCreateSubject';
import { useEditSubject } from '../../../features/subjects/hooks/mutations/useEditSubject';
import { useDeleteSubject } from '../../../features/subjects/hooks/mutations/useDeleteSubject';
import { useReorderSubjects } from '../../../features/subjects/hooks/mutations/useReorderSubjects';
import { useLibrary } from '../../../features/materials/hooks/queries/useLibrary';
import { useCreateMaterial } from '../../../features/materials/hooks/mutations/useCreateMaterial';
import { useDeleteMaterial } from '../../../features/materials/hooks/mutations/useDeleteMaterial';
import { useEditMaterial } from '../../../features/materials/hooks/mutations/useEditMaterial';
import LibraryView from '../../../features/materials/components/LibraryView';
import LibraryModals from './LibraryModals';

export interface LibraryHomeScreenProps {
  onOpenMaterial: (materialId: string) => void;
  onOpenSubject: (subjectId: string) => void;
  onStartQuiz: (request: QuizLaunchRequest) => void;
  onManage: (materialId: string, subjectId?: string) => void;
  onBrowseAvailable: () => void;
}

export function LibraryHomeScreen({
  onOpenMaterial,
  onOpenSubject,
  onStartQuiz,
  onManage,
  onBrowseAvailable,
}: LibraryHomeScreenProps) {
  const { materials, isLoading: materialsLoading } = useLibrary();
  const { subjects, isLoading: subjectsLoading } = useSubjects();
  const isLibraryLoading = materialsLoading || subjectsLoading;

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
  const [showCreateMaterial, setShowCreateMaterial] = useState(false);
  const [managingCollectionsMaterial, setManagingCollectionsMaterial] = useState<StudyMaterial | null>(null);

  const uncategorizedMaterials = materials.filter((m) => !m.subjectId);

  const handleNewMaterial = useCallback(() => {
    setShowCreateMaterial(true);
  }, []);

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
    (title: string, description: string, subjectId?: string | null, termId?: string | null, tags?: string[]) => {
      if (!editTarget) return;
      editMutation.mutate({
        id: editTarget.id,
        input: { title, description, subjectId, termId, tags },
      });
      setEditTarget(null);
    },
    [editTarget, editMutation],
  );

  const handleEditClose = useCallback(() => {
    setEditTarget(null);
  }, []);

  const handleCreateMaterialSave = useCallback(
    (title: string, description: string, subjectId?: string | null, termId?: string | null, tags?: string[]) => {
      createMutation.mutate({ title, description, subjectId: subjectId ?? undefined, termId: termId ?? undefined, tags });
      setShowCreateMaterial(false);
    },
    [createMutation],
  );

  const handleCreateMaterialClose = useCallback(() => {
    setShowCreateMaterial(false);
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

  const handleManageCollections = useCallback((material: StudyMaterial) => {
    setManagingCollectionsMaterial(material);
  }, []);

  const handleCloseManageCollections = useCallback(() => {
    setManagingCollectionsMaterial(null);
  }, []);

  return (
    <>
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
        onManageCollections={handleManageCollections}
        onBrowseAvailable={onBrowseAvailable}
        isSavingReorder={reorderSubjectsMutation.isPending}
        onSubjectEdit={handleSubjectEdit}
        onSubjectDelete={handleSubjectDelete}
        onSubjectReorder={handleSubjectReorder}
      />
      <LibraryModals
        subjects={subjects}
        editTarget={editTarget}
        deleteTarget={deleteTarget}
        subjectEditTarget={subjectEditTarget}
        subjectDeleteTarget={subjectDeleteTarget}
        showCreateSubject={showCreateSubject}
        showCreateMaterial={showCreateMaterial}
        onEditSave={handleEditSave}
        onEditClose={handleEditClose}
        onSubjectEditSave={handleSubjectEditSave}
        onSubjectEditClose={handleSubjectEditClose}
        onSubjectDeleteConfirm={handleSubjectDeleteConfirm}
        onSubjectDeleteClose={handleSubjectDeleteClose}
        onCreateSubjectSave={handleCreateSubjectSave}
        onCreateSubjectClose={handleCreateSubjectClose}
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
