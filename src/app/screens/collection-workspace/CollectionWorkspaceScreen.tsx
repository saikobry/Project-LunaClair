import { useCallback, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, BrainCircuit, FolderX } from 'lucide-react';
import type { AppRoute } from '../../routing/routing';
import type { UpdateCollectionInput } from '../../../domain/collections/models/Collection';
import type { QuizLaunchRequest } from '../../../features/quiz/types/quizFeature.types';
import { useCollection } from '../../../features/collections/hooks/queries/useCollection';
import { useCollectionMaterials } from '../../../features/collections/hooks/queries/useCollectionMaterials';
import { useCollectionQuizTree } from '../../../features/collections/hooks/queries/useCollectionQuizTree';
import { useRemoveMaterialFromCollection } from '../../../features/collections/hooks/mutations/useRemoveMaterialFromCollection';
import { useReorderCollectionMaterials } from '../../../features/collections/hooks/mutations/useReorderCollectionMaterials';
import { useUpdateCollection } from '../../../features/collections/hooks/mutations/useUpdateCollection';
import { useDeleteCollection } from '../../../features/collections/hooks/mutations/useDeleteCollection';
import { EditCollectionModal } from '../../../features/collections/modals/EditCollectionModal';
import { CollectionQuizExplorer } from '../../../features/collections/components/CollectionQuizExplorer';
import { CollectionMaterialList } from './components/CollectionMaterialList';
import { CollectionHero } from './components/CollectionHero';
import { Page } from '../../../shared/ui/Page/Page';
import { Button } from '../../../shared/ui/Button/Button';
import { Breadcrumbs } from '../../../shared/ui/Breadcrumbs/Breadcrumbs';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState/ErrorState';
import { TabList, Tab } from '../../../shared/ui/TabList/TabList';
import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';
import { WorkspaceSkeleton } from '../../../shared/ui/Skeleton/Skeleton';
import { AddMaterialsDrawer } from './modals/AddMaterialsDrawer';

const styles = stylex.create({
  loadingContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
});

export interface CollectionWorkspaceScreenProps {
  collectionId: string;
  onNavigate: (route: AppRoute) => void;
  onOpenMaterial?: (materialId: string) => void;
  onStartQuiz?: (request: QuizLaunchRequest) => void;
}

export function CollectionWorkspaceScreen({
  collectionId,
  onNavigate,
  onOpenMaterial,
  onStartQuiz,
}: CollectionWorkspaceScreenProps) {
  const { collection, isLoading: collectionLoading } = useCollection(collectionId);
  const { materials, isLoading: materialsLoading } = useCollectionMaterials(collectionId);
  const removeMutation = useRemoveMaterialFromCollection();
  const reorderMutation = useReorderCollectionMaterials();
  const updateMutation = useUpdateCollection();
  const deleteMutation = useDeleteCollection();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isAddMaterialsOpen, setIsAddMaterialsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'materials' | 'quizzes'>('materials');
  // Removal is confirmed through a dialog, so the row action only targets a
  // material and the mutation fires on confirm.
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);

  const { tree } = useCollectionQuizTree(collectionId, materials);

  const handleBackToLibrary = useCallback(() => {
    onNavigate({ kind: 'library' });
  }, [onNavigate]);

  const handleEditSave = useCallback(
    (id: string, input: UpdateCollectionInput) => {
      updateMutation.mutate(
        { id, input },
        { onSuccess: () => setIsEditOpen(false) },
      );
    },
    [updateMutation],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!collection) return;
    deleteMutation.mutateAsync(collection.id).then(handleBackToLibrary);
  }, [collection, deleteMutation, handleBackToLibrary]);

  const handleUpdateTitle = useCallback(
    (title: string) => {
      if (!collection) return;
      updateMutation.mutate({ id: collection.id, input: { title } });
    },
    [collection, updateMutation],
  );

  const handleUpdateDescription = useCallback(
    (description: string) => {
      if (!collection) return;
      updateMutation.mutate({ id: collection.id, input: { description } });
    },
    [collection, updateMutation],
  );

  const handleQuickStudy = useCallback(() => {
    const allQuizIds = tree.flatMap((group) => group.quizzes.map((quiz) => quiz.id));
    if (allQuizIds.length === 0) return;
    onStartQuiz?.({ type: 'quizzes', quizIds: allQuizIds, source: 'library' });
  }, [tree, onStartQuiz]);

  const handleAddMaterials = useCallback(() => {
    setIsAddMaterialsOpen(true);
  }, []);

  const handleRemoveMaterial = useCallback((materialId: string) => {
    setPendingRemovalId(materialId);
  }, []);

  const handleRemoveConfirm = useCallback(() => {
    if (!collection || !pendingRemovalId) return;
    removeMutation.mutate({ collectionId: collection.id, materialId: pendingRemovalId });
    setPendingRemovalId(null);
  }, [collection, pendingRemovalId, removeMutation]);

  const handleRemoveCancel = useCallback(() => {
    setPendingRemovalId(null);
  }, []);

  if (collectionLoading || materialsLoading) {
    return (
      <Page title="Collection">
        <div {...stylex.props(styles.loadingContainer)}>
          <WorkspaceSkeleton />
        </div>
      </Page>
    );
  }

  if (!collection) {
    return (
      <Page title="Collection not found">
        <ErrorState
          icon={<FolderX size={28} />}
          title="Collection could not be found"
          description="This collection does not exist or may have been removed from your library."
          action={
            <Button label="Back to Library" variant="primary" onClick={handleBackToLibrary}>
              Back to Library
            </Button>
          }
        />
      </Page>
    );
  }

  const pendingRemoval = pendingRemovalId
    ? materials.find((material) => material.id === pendingRemovalId) ?? null
    : null;

  const quizCount = tree.reduce((sum, group) => sum + group.quizzes.length, 0);
  // StudyMaterial carries no mastery field — average mastery stays 0 until a
  // real mastery signal exists. Kept as a computed value for the hero stats row.
  const averageMastery = 0;

  return (
    <Page
      title={collection.title}
      headerHidden
      breadcrumb={
        <Breadcrumbs
          items={[
            { label: 'Library', onClick: handleBackToLibrary },
            { label: collection.title },
          ]}
        />
      }
    >
      <CollectionHero
        collection={collection}
        materials={materials}
        quizCount={quizCount}
        averageMastery={averageMastery}
        onUpdateTitle={handleUpdateTitle}
        onUpdateDescription={handleUpdateDescription}
        onQuickStudy={handleQuickStudy}
        onAddMaterials={handleAddMaterials}
        onEdit={() => setIsEditOpen(true)}
        onDelete={() => setIsDeleteOpen(true)}
      />

      {materials.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} />}
          title="No materials in this collection yet"
          description="Add study materials to this collection to organize them into a collection you can work through."
          headingLevel="h3"
          action={
            <Button label="Back to Library" variant="primary" onClick={handleBackToLibrary}>
              Back to Library
            </Button>
          }
        />
      ) : (
        <>
          <TabList
            value={activeTab}
            onChange={(tab) => setActiveTab(tab as 'materials' | 'quizzes')}
            layout="fill"
            hasDivider
            aria-label="Collection tabs"
          >
            <Tab value="materials" label="Materials" icon={<BookOpen size={15} />} />
            <Tab value="quizzes" label="Quizzes" icon={<BrainCircuit size={15} />} />
          </TabList>

          {activeTab === 'materials' ? (
            <CollectionMaterialList
              collectionId={collection.id}
              materials={materials}
              onOpenMaterial={onOpenMaterial}
              onRemoveMaterial={handleRemoveMaterial}
              onReorder={(orderedIds) =>
                reorderMutation.mutate({
                  collectionId: collection.id,
                  orderedMaterialIds: orderedIds,
                })
              }
              onAddMaterials={handleAddMaterials}
            />
          ) : (
            <CollectionQuizExplorer
              collectionId={collectionId}
              materials={materials}
              onStartQuiz={onStartQuiz}
            />
          )}
        </>
      )}

      {collection && (
        <EditCollectionModal
          collection={collection}
          isOpen={isEditOpen}
          onSave={handleEditSave}
          onDelete={() => {
            setIsEditOpen(false);
            setIsDeleteOpen(true);
          }}
          onClose={() => setIsEditOpen(false)}
        />
      )}

      {collection && (
        <AddMaterialsDrawer
          isOpen={isAddMaterialsOpen}
          collection={collection}
          currentMaterialIds={materials.map((m) => m.id)}
          onClose={() => setIsAddMaterialsOpen(false)}
        />
      )}

      <ConfirmationDialog
        isOpen={pendingRemoval !== null}
        title="Remove from Collection"
        message={`Remove "${pendingRemoval?.title ?? ''}" from this collection? (The material stays in your Library)`}
        confirmLabel="Remove"
        intent="danger"
        onConfirm={handleRemoveConfirm}
        onCancel={handleRemoveCancel}
      />

      <ConfirmationDialog
        isOpen={isDeleteOpen}
        title="Delete Collection"
        message="Delete this collection? (Materials inside will not be deleted)"
        confirmLabel="Delete"
        intent="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </Page>
  );
}

export default CollectionWorkspaceScreen;
