import { useCallback } from 'react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import EditMaterialModal from '../../../features/materials/modals/EditMaterialModal';
import CreateMaterialModal from '../../../features/materials/modals/CreateMaterialModal';
import DeleteConfirmationModal from '../../../features/materials/modals/DeleteConfirmationModal';
import CreateCollectionModal from '../../../features/collections/modals/CreateCollectionModal';
import { useCreateCollection } from '../../../features/collections/hooks/mutations/useCreateCollection';

export interface LibraryModalsProps {
  editTarget: StudyMaterial | null;
  deleteTarget: StudyMaterial | null;
  showCreateMaterial: boolean;
  showCreateCollection: boolean;
  onEditSave: (title: string, description: string, tags?: string[]) => void;
  onEditClose: () => void;
  onCreateMaterialSave: (title: string, description: string, tags?: string[]) => void;
  onCreateMaterialClose: () => void;
  onDeleteConfirm: () => void;
  onDeleteClose: () => void;
  /** Receives the created collection so the caller can navigate to it. */
  onCreateCollectionSave: (input: {
    title: string;
    description?: string;
    icon?: string;
    color?: string;
  }) => void;
  onCreateCollectionClose: () => void;
}

/**
 * Dialog container for the Library screen: material create/edit/delete plus
 * collection creation.
 *
 * Material-to-collection assignment is NOT here — `MaterialCard` owns an inline
 * collections popover, so the previous (never-opened) modal wiring was removed
 * rather than duplicated.
 */
export function LibraryModals({
  editTarget,
  deleteTarget,
  showCreateMaterial,
  showCreateCollection,
  onEditSave,
  onEditClose,
  onCreateMaterialSave,
  onCreateMaterialClose,
  onDeleteConfirm,
  onDeleteClose,
  onCreateCollectionSave,
  onCreateCollectionClose,
}: LibraryModalsProps) {
  const createCollectionMutation = useCreateCollection();

  const handleCreateCollectionSave = useCallback(
    (input: { title: string; description?: string; icon?: string; color?: string }) => {
      createCollectionMutation.mutate(input);
      onCreateCollectionSave(input);
    },
    [createCollectionMutation, onCreateCollectionSave],
  );

  return (
    <>
      {editTarget && (
        <EditMaterialModal
          initialTitle={editTarget.title}
          initialDescription={editTarget.description ?? ''}
          initialTags={editTarget.tags ?? []}
          onSave={onEditSave}
          onClose={onEditClose}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmationModal
          title={deleteTarget.title}
          onConfirm={onDeleteConfirm}
          onClose={onDeleteClose}
        />
      )}

      {showCreateMaterial && (
        <CreateMaterialModal
          onSave={onCreateMaterialSave}
          onClose={onCreateMaterialClose}
        />
      )}

      <CreateCollectionModal
        isOpen={showCreateCollection}
        onSave={handleCreateCollectionSave}
        onClose={onCreateCollectionClose}
      />
    </>
  );
}

export default LibraryModals;
