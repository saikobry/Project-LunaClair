import { useCallback, useState } from 'react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { Subject } from '../../../domain/library/models/Subject';
import EditMaterialModal from '../../../features/materials/modals/EditMaterialModal';
import EditSubjectModal from '../../../features/subjects/modals/EditSubjectModal';
import CreateSubjectModal from '../../../features/subjects/modals/CreateSubjectModal';
import CreateMaterialModal from '../../../features/materials/modals/CreateMaterialModal';
import DeleteConfirmationModal from '../../../features/materials/modals/DeleteConfirmationModal';
import ManageMaterialCollectionsModal from '../../../features/collections/modals/ManageMaterialCollectionsModal';
import CreateCollectionModal from '../../../features/collections/modals/CreateCollectionModal';
import { useTerms } from '../../../features/terms/hooks/queries/useTerms';
import { useCollections } from '../../../features/collections/hooks/queries/useCollections';
import { useMaterialCollections } from '../../../features/collections/hooks/queries/useMaterialCollections';
import { useCreateCollection } from '../../../features/collections/hooks/mutations/useCreateCollection';
import { useAddMaterialToCollection } from '../../../features/collections/hooks/mutations/useAddMaterialToCollection';
import { useRemoveMaterialFromCollection } from '../../../features/collections/hooks/mutations/useRemoveMaterialFromCollection';

export interface LibraryModalsProps {
  subjects: Subject[];
  editTarget: StudyMaterial | null;
  deleteTarget: StudyMaterial | null;
  subjectEditTarget: Subject | null;
  subjectDeleteTarget: Subject | null;
  showCreateSubject: boolean;
  showCreateMaterial: boolean;
  onEditSave: (title: string, description: string, subjectId?: string | null, termId?: string | null, tags?: string[]) => void;
  onEditClose: () => void;
  onSubjectEditSave: (title: string, description: string) => void;
  onSubjectEditClose: () => void;
  onSubjectDeleteConfirm: () => void;
  onSubjectDeleteClose: () => void;
  onCreateSubjectSave: (title: string, description: string) => void;
  onCreateSubjectClose: () => void;
  onCreateMaterialSave: (title: string, description: string, subjectId?: string | null, termId?: string | null, tags?: string[]) => void;
  onCreateMaterialClose: () => void;
  onDeleteConfirm: () => void;
  onDeleteClose: () => void;
  managingCollectionsMaterial: StudyMaterial | null;
  onCloseManageCollections: () => void;
}

export function LibraryModals({
  subjects,
  editTarget,
  deleteTarget,
  subjectEditTarget,
  subjectDeleteTarget,
  showCreateSubject,
  showCreateMaterial,
  onEditSave,
  onEditClose,
  onSubjectEditSave,
  onSubjectEditClose,
  onSubjectDeleteConfirm,
  onSubjectDeleteClose,
  onCreateSubjectSave,
  onCreateSubjectClose,
  onCreateMaterialSave,
  onCreateMaterialClose,
  onDeleteConfirm,
  onDeleteClose,
  managingCollectionsMaterial,
  onCloseManageCollections,
}: LibraryModalsProps) {
  const { terms } = useTerms();
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
          initialSubjectId={editTarget.subjectId}
          initialTermId={editTarget.termId}
          initialTags={editTarget.tags ?? []}
          subjects={subjects}
          terms={terms}
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

      {subjectEditTarget && (
        <EditSubjectModal
          initialTitle={subjectEditTarget.title}
          initialDescription={subjectEditTarget.description ?? ''}
          onSave={onSubjectEditSave}
          onClose={onSubjectEditClose}
        />
      )}

      {subjectDeleteTarget && (
        <DeleteConfirmationModal
          title={subjectDeleteTarget.title}
          onConfirm={onSubjectDeleteConfirm}
          onClose={onSubjectDeleteClose}
        />
      )}

      {showCreateSubject && (
        <CreateSubjectModal
          onSave={onCreateSubjectSave}
          onClose={onCreateSubjectClose}
        />
      )}

      {showCreateMaterial && (
        <CreateMaterialModal
          subjects={subjects}
          terms={terms}
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
