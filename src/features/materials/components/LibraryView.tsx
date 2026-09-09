import * as stylex from '@stylexjs/stylex';
import {
  BookHeart,
  LibraryBig,
  Plus,
} from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import { Page } from '../../../shared/ui/Page/Page';
import { Button } from '../../../shared/ui/Button/Button';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import MaterialGrid from './MaterialGrid';
import { CardGridSkeleton } from '../../../shared/ui/Skeleton/Skeleton';

const localStyles = stylex.create({
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  sectionCount: {
    fontSize: 13,
    color: 'var(--color-text-disabled)',
  },
});

interface LibraryViewProps {
  isLoading?: boolean;
  materials: StudyMaterial[];
  onNewMaterial: () => void;
  onOpen: (material: StudyMaterial) => void;
  onEdit: (material: StudyMaterial) => void;
  onDelete: (material: StudyMaterial) => void;
  onStartQuiz: (material: StudyMaterial) => void;
  onManage: (material: StudyMaterial) => void;
  onManageCollections?: (material: StudyMaterial) => void;
  onBrowseAvailable: () => void;
}

export default function LibraryView({
  isLoading = false,
  materials,
  onNewMaterial,
  onOpen,
  onEdit,
  onDelete,
  onStartQuiz,
  onManage,
  onManageCollections,
  onBrowseAvailable,
}: LibraryViewProps) {
  const totalCount = materials.length;
  const description = isLoading
    ? undefined
    : `${totalCount} ${totalCount === 1 ? 'material' : 'materials'}`;

  return (
    <Page
      title="Study Library"
      description={description}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            label="New Material"
            variant="primary"
            icon={<Plus size={18} />}
            onClick={onNewMaterial}
          >
            New Material
          </Button>
        </div>
      }
    >
      {/* Loading State — skeleton while queries are in-flight */}
      {isLoading && (
        <div {...stylex.props(localStyles.section)}>
          <div {...stylex.props(localStyles.sectionHeader)}>
            <h2 {...stylex.props(localStyles.sectionTitle)}>Materials</h2>
          </div>
          <CardGridSkeleton count={6} />
        </div>
      )}

      {/* Materials */}
      {!isLoading && materials.length > 0 && (
        <div {...stylex.props(localStyles.section)}>
          <div {...stylex.props(localStyles.sectionHeader)}>
            <h2 {...stylex.props(localStyles.sectionTitle)}>Materials</h2>
            <span {...stylex.props(localStyles.sectionCount)}>
              {materials.length} {materials.length === 1 ? 'material' : 'materials'}
            </span>
          </div>
          <MaterialGrid
            materials={materials}
            onOpen={onOpen}
            onEdit={onEdit}
            onDelete={onDelete}
            onStartQuiz={onStartQuiz}
            onManage={onManage}
            onManageCollections={onManageCollections}
          />
        </div>
      )}

      {/* Empty State — only shown when nothing exists at all */}
      {!isLoading && materials.length === 0 && (
        <EmptyState
          icon={<BookHeart size={56} />}
          title="Your library is empty"
          description="Explore study packages on the Explore hub and clone them to your library. Cloned packages are available offline, including their quizzes."
          action={
            <Button
              label="Explore Study Packages"
              variant="primary"
              icon={<LibraryBig size={18} />}
              onClick={onBrowseAvailable}
            >
              Explore Study Packages
            </Button>
          }
        />
      )}
    </Page>
  );
}
