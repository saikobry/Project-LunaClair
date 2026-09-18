import { useCallback } from 'react';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import EditMaterialModal from '../../../../features/materials/modals/EditMaterialModal';
import CreateMaterialModal from '../../../../features/materials/modals/CreateMaterialModal';
import RemoveMaterialModal from '../../../../features/materials/modals/RemoveMaterialModal';
import CreateCollectionModal from '../../../../features/collections/modals/CreateCollectionModal';
import { useCreateCollection } from '../../../../features/collections/hooks/mutations/useCreateCollection';

export interface LibraryModalsProps {
  editTarget: StudyMaterial | null;
  removeTarget: StudyMaterial | null;
  showCreateMaterial: boolean;
  showCreateCollection: boolean;
  onEditSave: (title: string, description: string, tags?: string[]) => void;
  onEditClose: () => void;
  onCreateMaterialSave: (title: string, description: string, tags?: string[]) => void;
  onCreateMaterialClose: () => void;
  onRemoveConfirm: () => void;
  onRemoveClose: () => void;
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
 * Dialog container for the Library screen: material create/edit/removal plus
 * collection creation.
 *
 * Material-to-collection assignment is NOT here — `MaterialCard` owns an inline
 * collections popover, so the previous (never-opened) modal wiring was removed
 * rather than duplicated.
 */
export function LibraryModals({
  editTarget,
  removeTarget,
  showCreateMaterial,
  showCreateCollection,
  onEditSave,
  onEditClose,
  onCreateMaterialSave,
  onCreateMaterialClose,
  onRemoveConfirm,
  onRemoveClose,
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

      {removeTarget && (
        <RemoveMaterialModal
          material={removeTarget}
          onConfirm={onRemoveConfirm}
          onClose={onRemoveClose}
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
