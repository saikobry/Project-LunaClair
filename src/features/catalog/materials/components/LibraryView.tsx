import * as stylex from '@stylexjs/stylex';
import {
  Plus,
  BookHeart,
} from 'lucide-react';
import type { StudyMaterial } from '../../../../domain/library';
import type { Subject } from '../../../../domain/library';
import { Page } from '../../../../shared/ui/Page';
import { Button } from '../../../../shared/ui/Button/Button';
import { styles } from '../../shared/styles/library.stylex';
import MaterialGrid from './MaterialGrid';
import SubjectCardGrid from './SubjectCardGrid';
import { CardGridSkeleton } from '../../../../shared/ui/Skeleton/Skeleton';
import EditMaterialModal from '../modals/EditMaterialModal';
import EditSubjectModal from '../../subjects/modals/EditSubjectModal';
import CreateSubjectModal from '../../subjects/modals/CreateSubjectModal';
import DeleteConfirmationModal from '../modals/DeleteConfirmationModal';

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
  editTarget: StudyMaterial | null;
  deleteTarget: StudyMaterial | null;
  subjectEditTarget: Subject | null;
  subjectDeleteTarget: Subject | null;
  showCreateSubject: boolean;
  isSavingReorder?: boolean;
  onEditSave: (title: string, description: string, subjectId?: string | null, termId?: string | null) => void;
  onEditClose: () => void;
  onSubjectEdit: (subject: Subject) => void;
  onSubjectDelete: (subject: Subject) => void;
  onSubjectReorder: (orderedIds: string[]) => void;
  onSubjectEditSave: (title: string, description: string) => void;
  onSubjectEditClose: () => void;
  onSubjectDeleteConfirm: () => void;
  onSubjectDeleteClose: () => void;
  onCreateSubjectSave: (title: string, description: string) => void;
  onCreateSubjectClose: () => void;
  onDeleteConfirm: () => void;
  onDeleteClose: () => void;
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
  editTarget,
  deleteTarget,
  subjectEditTarget,
  subjectDeleteTarget,
  showCreateSubject,
  isSavingReorder,
  onEditSave,
  onEditClose,
  onSubjectEdit,
  onSubjectDelete,
  onSubjectReorder,
  onSubjectEditSave,
  onSubjectEditClose,
  onSubjectDeleteConfirm,
  onSubjectDeleteClose,
  onCreateSubjectSave,
  onCreateSubjectClose,
  onDeleteConfirm,
  onDeleteClose,
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
        <div {...stylex.props(styles.emptyState)}>
          <div {...stylex.props(styles.emptyIcon)}>
            <BookHeart size={64} />
          </div>
          <h2 {...stylex.props(styles.emptyTitle)}>Your library is empty</h2>
          <p {...stylex.props(styles.emptyText)}>
            Create your first study material to get started. You can add content
            from markdown files, PDFs, or generate quizzes and flashcards.
          </p>
          <Button
            label="Create Material"
            variant="primary"
            icon={<Plus size={18} />}
            onClick={onNewMaterial}
          >
            Create Material
          </Button>
        </div>
      )}

      {/* Modals */}
      {editTarget && (
        <EditMaterialModal
          initialTitle={editTarget.title}
          initialDescription={editTarget.description ?? ''}
          initialSubjectId={editTarget.subjectId}
          initialTermId={editTarget.termId}
          subjects={subjects}
          onSave={onEditSave}
          onClose={onEditClose}
        />
      )}

      {showCreateSubject && (
        <CreateSubjectModal
          onSave={onCreateSubjectSave}
          onClose={onCreateSubjectClose}
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
          itemType="Subject"
          onConfirm={onSubjectDeleteConfirm}
          onClose={onSubjectDeleteClose}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmationModal
          title={deleteTarget.title}
          onConfirm={onDeleteConfirm}
          onClose={onDeleteClose}
        />
      )}
    </Page>
  );
}
