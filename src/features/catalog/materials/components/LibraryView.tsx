import * as stylex from '@stylexjs/stylex';
import {
  Plus,
  BookHeart,
  LibraryBig,
} from 'lucide-react';
import type { StudyMaterial } from '../../../../domain/library';
import type { Subject } from '../../../../domain/library';
import { Page } from '../../../../shared/ui/Page';
import { Button } from '../../../../shared/ui/Button/Button';
import { EmptyState } from '../../../../shared/ui/EmptyState/EmptyState';
import MaterialGrid from './MaterialGrid';
import SubjectCardGrid from './SubjectCardGrid';
import { CardGridSkeleton } from '../../../../shared/ui/Skeleton/Skeleton';

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
  subjects: Subject[];
  materials: StudyMaterial[];
  allMaterials: StudyMaterial[];
  onNewMaterial: () => void;
  onNewSubject: () => void;
  onOpen: (material: StudyMaterial) => void;
  onOpenSubject: (subjectId: string) => void;
  onEdit: (material: StudyMaterial) => void;
  onDelete: (material: StudyMaterial) => void;
  onStartQuiz: (material: StudyMaterial) => void;
  onManage: (material: StudyMaterial) => void;
  onBrowseAvailable: () => void;
  isSavingReorder?: boolean;
  onSubjectEdit: (subject: Subject) => void;
  onSubjectDelete: (subject: Subject) => void;
  onSubjectReorder: (orderedIds: string[]) => void;
}

export default function LibraryView({
  isLoading = false,
  subjects,
  materials,
  allMaterials,
  onNewMaterial,
  onNewSubject,
  onOpen,
  onOpenSubject,
  onEdit,
  onDelete,
  onStartQuiz,
  onManage,
  onBrowseAvailable,
  isSavingReorder,
  onSubjectEdit,
  onSubjectDelete,
  onSubjectReorder,
}: LibraryViewProps) {
  const totalCount = allMaterials.length;
  const description = isLoading
    ? undefined
    : `${subjects.length} ${subjects.length === 1 ? 'subject' : 'subjects'} · ${totalCount} ${totalCount === 1 ? 'material' : 'materials'}`;

  return (
    <Page
      title="Study Library"
      description={description}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            label="New Subject"
            variant="secondary"
            icon={<Plus size={18} />}
            onClick={onNewSubject}
          >
            New Subject
          </Button>
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
            <h2 {...stylex.props(localStyles.sectionTitle)}>Subjects</h2>
          </div>
          <CardGridSkeleton count={6} />
        </div>
      )}

      {/* Subjects Grid */}
      {!isLoading && subjects.length > 0 && (
        <SubjectCardGrid
          subjects={subjects}
          allMaterials={allMaterials}
          isSavingReorder={isSavingReorder}
          onOpenSubject={onOpenSubject}
          onSubjectEdit={onSubjectEdit}
          onSubjectDelete={onSubjectDelete}
          onSubjectReorder={onSubjectReorder}
        />
      )}

      {/* Uncategorized Materials */}
      {!isLoading && materials.length > 0 && (
        <div {...stylex.props(localStyles.section)}>
          <div {...stylex.props(localStyles.sectionHeader)}>
            <h2 {...stylex.props(localStyles.sectionTitle)}>Uncategorized</h2>
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
          />
        </div>
      )}

      {/* Empty State — only shown when nothing exists at all */}
      {!isLoading && subjects.length === 0 && materials.length === 0 && (
        <EmptyState
          icon={<BookHeart size={56} />}
          title="Your library is empty"
          description="Browse the platform catalog and add materials to your library. Imported materials are available offline, including their quizzes."
          action={
            <Button
              label="Browse Available Materials"
              variant="primary"
              icon={<LibraryBig size={18} />}
              onClick={onBrowseAvailable}
            >
              Browse Available Materials
            </Button>
          }
        />
      )}
    </Page>
  );
}
