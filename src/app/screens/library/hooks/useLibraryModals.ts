import { useState, useCallback } from 'react';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import { useCreateMaterial } from '../../../../features/materials/hooks/mutations/useCreateMaterial';
import { useDeleteMaterial } from '../../../../features/materials/hooks/mutations/useDeleteMaterial';
import { useEditMaterial } from '../../../../features/materials/hooks/mutations/useEditMaterial';

/**
 * Library dialog state: material edit/delete/create plus collection creation.
 * Extracted so `LibraryScreen` stays a composer — one decision cluster per unit.
 */
export function useLibraryModals() {
  const createMutation = useCreateMaterial();
  const deleteMutation = useDeleteMaterial();
  const editMutation = useEditMaterial();

  const [editTarget, setEditTarget] = useState<StudyMaterial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);
  const [showCreateMaterial, setShowCreateMaterial] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);

  const handleNewMaterial = useCallback(() => {
    setShowCreateMaterial(true);
  }, []);

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

  const openCreateCollection = useCallback(() => {
    setShowCreateCollection(true);
  }, []);

  const handleCreateCollectionSave = useCallback(() => {
    setShowCreateCollection(false);
  }, []);

  const handleCreateCollectionClose = useCallback(() => {
    setShowCreateCollection(false);
  }, []);

  return {
    editTarget,
    deleteTarget,
    showCreateMaterial,
    showCreateCollection,
    handleNewMaterial,
    handleEditTrigger,
    handleEditSave,
    handleEditClose,
    handleCreateMaterialSave,
    handleCreateMaterialClose,
    handleDeleteTrigger,
    handleDeleteConfirm,
    handleDeleteClose,
    openCreateCollection,
    handleCreateCollectionSave,
    handleCreateCollectionClose,
  };
}
