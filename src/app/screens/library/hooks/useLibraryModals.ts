import { useState, useCallback } from 'react';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import { useCreateMaterial } from '../../../../features/materials/hooks/mutations/useCreateMaterial';
import { useRemoveMaterial } from '../../../../features/materials/hooks/mutations/useRemoveMaterial';
import { useEditMaterial } from '../../../../features/materials/hooks/mutations/useEditMaterial';

/**
 * Library dialog state: material edit/remove/create plus collection creation.
 * Extracted so `LibraryScreen` stays a composer — one decision cluster per unit.
 */
export function useLibraryModals() {
  const createMutation = useCreateMaterial();
  const removeMutation = useRemoveMaterial();
  const editMutation = useEditMaterial();

  const [editTarget, setEditTarget] = useState<StudyMaterial | null>(null);
  const [removeTarget, setRemoveTarget] = useState<StudyMaterial | null>(null);
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

  const handleRemoveTrigger = useCallback((material: StudyMaterial) => {
    setRemoveTarget(material);
  }, []);

  const handleRemoveConfirm = useCallback(() => {
    if (!removeTarget) return;
    removeMutation.mutate(removeTarget.id);
    setRemoveTarget(null);
  }, [removeTarget, removeMutation]);

  const handleRemoveClose = useCallback(() => {
    setRemoveTarget(null);
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
    removeTarget,
    showCreateMaterial,
    showCreateCollection,
    handleNewMaterial,
    handleEditTrigger,
    handleEditSave,
    handleEditClose,
    handleCreateMaterialSave,
    handleCreateMaterialClose,
    handleRemoveTrigger,
    handleRemoveConfirm,
    handleRemoveClose,
    openCreateCollection,
    handleCreateCollectionSave,
    handleCreateCollectionClose,
  };
}
