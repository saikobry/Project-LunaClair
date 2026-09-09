import { useCallback, useState } from 'react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import EditMaterialModal from '../../../features/materials/modals/EditMaterialModal';
import CreateMaterialModal from '../../../features/materials/modals/CreateMaterialModal';
import DeleteConfirmationModal from '../../../features/materials/modals/DeleteConfirmationModal';
import ManageMaterialCollectionsModal from '../../../features/collections/modals/ManageMaterialCollectionsModal';
import CreateCollectionModal from '../../../features/collections/modals/CreateCollectionModal';
import { useCollections } from '../../../features/collections/hooks/queries/useCollections';
import { useMaterialCollections } from '../../../features/collections/hooks/queries/useMaterialCollections';
import { useCreateCollection } from '../../../features/collections/hooks/mutations/useCreateCollection';
import { useAddMaterialToCollection } from '../../../features/collections/hooks/mutations/useAddMaterialToCollection';
import { useRemoveMaterialFromCollection } from '../../../features/collections/hooks/mutations/useRemoveMaterialFromCollection';

export interface LibraryModalsProps {
  editTarget: StudyMaterial | null;
  deleteTarget: StudyMaterial | null;
  showCreateMaterial: boolean;
  onEditSave: (title: string, description: string, tags?: string[]) => void;
  onEditClose: () => void;
  onCreateMaterialSave: (title: string, description: string, tags?: string[]) => void;
  onCreateMaterialClose: () => void;
  onDeleteConfirm: () => void;
  onDeleteClose: () => void;
  managingCollectionsMaterial: StudyMaterial | null;
  onCloseManageCollections: () => void;
}

export function LibraryModals({
  editTarget,
  deleteTarget,
  showCreateMaterial,
  onEditSave,
  onEditClose,
  onCreateMaterialSave,
  onCreateMaterialClose,
  onDeleteConfirm,
  onDeleteClose,
  managingCollectionsMaterial,
  onCloseManageCollections,
}: LibraryModalsProps) {
  const { collections } = useCollections();
  const { collectionIds } = useMaterialCollections(managingCollectionsMaterial?.id);
  const createCollectionMutation = useCreateCollection();
  const addMaterialMutation = useAddMaterialToCollection();
  const removeMaterialMutation = useRemoveMaterialFromCollection();

  const [showCreateCollection, setShowCreateCollection] = useState(false);

  const handleToggleCollection = useCallback(
    async (collectionId: string, assigned: boolean) => {
      if (!managingCollectionsMaterial) return;
      if (assigned) {
        await addMaterialMutation.mutateAsync({ collectionId, materialId: managingCollectionsMaterial.id });
      } else {
        await removeMaterialMutation.mutateAsync({ collectionId, materialId: managingCollectionsMaterial.id });
      }
    },
    [managingCollectionsMaterial, addMaterialMutation, removeMaterialMutation],
  );

  const handleCreateCollectionSave = useCallback(
    (input: { title: string; description?: string; icon?: string; color?: string }) => {
      createCollectionMutation.mutate(input);
      setShowCreateCollection(false);
    },
    [createCollectionMutation],
  );

  const handleOpenCreateCollection = useCallback(() => {
    setShowCreateCollection(true);
  }, []);

  const handleCloseCreateCollection = useCallback(() => {
    setShowCreateCollection(false);
  }, []);

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

      {managingCollectionsMaterial && (
        <ManageMaterialCollectionsModal
          isOpen={Boolean(managingCollectionsMaterial)}
          materialId={managingCollectionsMaterial.id}
          materialTitle={managingCollectionsMaterial.title}
          collections={collections}
          assignedCollectionIds={collectionIds}
          onToggle={handleToggleCollection}
          onCreateNewCollection={handleOpenCreateCollection}
          onClose={onCloseManageCollections}
        />
      )}

      {showCreateCollection && (
        <CreateCollectionModal
          isOpen={showCreateCollection}
          onSave={handleCreateCollectionSave}
          onClose={handleCloseCreateCollection}
        />
      )}
    </>
  );
}

export default LibraryModals;
