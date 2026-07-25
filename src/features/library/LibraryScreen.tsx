import { useState, useCallback } from 'react';
import type { StudyMaterial } from '../../domain/library';
import { useLibrary } from './hooks';
import LibraryView from './LibraryView';

interface LibraryScreenProps {
  onOpenMaterial: (material: StudyMaterial) => void;
}

export default function LibraryScreen({ onOpenMaterial }: LibraryScreenProps) {
  const { materials, createMaterial, updateMaterial, deleteMaterial } = useLibrary();

  const [renameTarget, setRenameTarget] = useState<StudyMaterial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);

  const handleNewMaterial = useCallback(() => {
    const title = `Study Material ${materials.length + 1}`;
    createMaterial(title);
  }, [materials.length, createMaterial]);

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
      updateMaterial(renameTarget.id, { title, description });
      setRenameTarget(null);
    },
    [renameTarget, updateMaterial],
  );

  const handleRenameClose = useCallback(() => {
    setRenameTarget(null);
  }, []);

  const handleDeleteTrigger = useCallback((material: StudyMaterial) => {
    setDeleteTarget(material);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMaterial(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteMaterial]);

  const handleDeleteClose = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  return (
    <LibraryView
      materials={materials}
      onNewMaterial={handleNewMaterial}
      onOpen={handleOpen}
      onRename={handleRenameTrigger}
      onDelete={handleDeleteTrigger}
      renameTarget={renameTarget}
      deleteTarget={deleteTarget}
      onRenameSave={handleRenameSave}
      onRenameClose={handleRenameClose}
      onDeleteConfirm={handleDeleteConfirm}
      onDeleteClose={handleDeleteClose}
    />
  );
}
