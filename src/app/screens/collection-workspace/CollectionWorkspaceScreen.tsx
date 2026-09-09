import { useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { BookOpen, FolderX, SquarePen, Trash2 } from 'lucide-react';
import type { AppRoute } from '../../routing/routing';
import { useCollection } from '../../../features/collections/hooks/queries/useCollection';
import { useCollectionMaterials } from '../../../features/collections/hooks/queries/useCollectionMaterials';
import { useRemoveMaterialFromCollection } from '../../../features/collections/hooks/mutations/useRemoveMaterialFromCollection';
import { useDeleteCollection } from '../../../features/collections/hooks/mutations/useDeleteCollection';
import { MaterialCard } from '../../../features/materials/components/MaterialCard';
import { Page } from '../../../shared/ui/Page/Page';
import { Button } from '../../../shared/ui/Button/Button';
import { Breadcrumbs } from '../../../shared/ui/Breadcrumbs/Breadcrumbs';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import { ErrorState } from '../../../shared/ui/ErrorState/ErrorState';
import { WorkspaceSkeleton } from '../../../shared/ui/Skeleton/Skeleton';

const styles = stylex.create({
  loadingContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  headerMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    flexShrink: 0,
  },
  count: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  cardSlot: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
});

export interface CollectionWorkspaceScreenProps {
  collectionId: string;
  onNavigate: (route: AppRoute) => void;
  onOpenMaterial?: (materialId: string) => void;
  /**
   * Invoked when "Edit Collection" is pressed. The edit dialog itself is
   * owned by `features/collections/modals/` — the button renders only when
   * a handler is provided.
   */
  onEditCollection?: (collectionId: string) => void;
}

export function CollectionWorkspaceScreen({
  collectionId,
  onNavigate,
  onOpenMaterial,
  onEditCollection,
}: CollectionWorkspaceScreenProps) {
  const { collection, isLoading: collectionLoading } = useCollection(collectionId);
  const { materials, isLoading: materialsLoading } = useCollectionMaterials(collectionId);
  const removeMutation = useRemoveMaterialFromCollection();
  const deleteMutation = useDeleteCollection();

  const handleBackToLibrary = useCallback(() => {
    onNavigate({ kind: 'library' });
  }, [onNavigate]);

  const handleDelete = useCallback(() => {
    if (!collection) return;
    const confirmed = window.confirm(
      `Delete collection "${collection.title}"? Its materials stay in your library.`,
    );
    if (!confirmed) return;
    deleteMutation.mutate(collection.id, { onSuccess: handleBackToLibrary });
  }, [collection, deleteMutation, handleBackToLibrary]);

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

  const description = [collection.description, `${materials.length} ${materials.length === 1 ? 'material' : 'materials'}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <Page
      title={collection.title}
      description={description}
      breadcrumb={
        <Breadcrumbs
          items={[
            { label: 'Library', onClick: handleBackToLibrary },
            { label: collection.title },
          ]}
        />
      }
      actions={
        <>
          {onEditCollection && (
            <Button
              label="Edit Collection"
              variant="secondary"
              icon={<SquarePen size={16} />}
              onClick={() => onEditCollection(collection.id)}
            >
              Edit Collection
            </Button>
          )}
          <Button
            label="Delete Collection"
            variant="secondary"
            icon={<Trash2 size={16} />}
            onClick={handleDelete}
          >
            Delete Collection
          </Button>
        </>
      }
    >
      <div {...stylex.props(styles.headerMeta)}>
        {collection.color && (
          <span
            {...stylex.props(styles.colorDot)}
            style={{ backgroundColor: collection.color }}
            aria-label={`Collection color ${collection.color}`}
          />
        )}
        <span {...stylex.props(styles.count)}>
          {materials.length} {materials.length === 1 ? 'material' : 'materials'} in this collection
        </span>
      </div>

      {materials.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} />}
          title="No materials in this collection yet"
          description="Add study materials to this collection to organize them into a playlist you can work through."
          headingLevel="h3"
          action={
            <Button label="Back to Library" variant="primary" onClick={handleBackToLibrary}>
              Back to Library
            </Button>
          }
        />
      ) : (
        <div {...stylex.props(styles.grid)}>
          {materials.map((material) => (
            <div key={material.id} {...stylex.props(styles.cardSlot)}>
              <MaterialCard material={material} onOpen={(m) => onOpenMaterial?.(m.id)} />
              <Button
                label={`Remove ${material.title} from collection`}
                variant="secondary"
                icon={<Trash2 size={14} />}
                onClick={() =>
                  removeMutation.mutate({ collectionId: collection.id, materialId: material.id })
                }
              >
                Remove from Collection
              </Button>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}

export default CollectionWorkspaceScreen;
