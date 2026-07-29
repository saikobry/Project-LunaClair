import * as stylex from '@stylexjs/stylex';
import { Plus, BookHeart, GraduationCap, ArrowRight } from 'lucide-react';
import type { StudyMaterial } from '../../domain/library';
import type { Subject } from '../../domain/library';
import { Page } from '../../shared/ui/Page';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { styles } from './styles/library.stylex';
import MaterialGrid from './components/MaterialGrid';
import RenameMaterialModal from './components/RenameMaterialModal';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';

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
  subjectsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },
  subjectCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 20,
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    ':hover': {
      transform: 'translateY(-2px)',
    },
  },
  subjectIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
  },
  subjectTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  subjectDescription: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  subjectMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: 'var(--color-text-disabled)',
    marginTop: 4,
  },
  divider: {
    height: 1,
    background: 'var(--color-border)',
    margin: '24px 0',
  },
});

interface LibraryViewProps {
  subjects: Subject[];
  materials: StudyMaterial[];
  allMaterials: StudyMaterial[];
  onNewMaterial: () => void;
  onOpen: (material: StudyMaterial) => void;
  onOpenSubject: (subjectId: string) => void;
  onRename: (material: StudyMaterial) => void;
  onDelete: (material: StudyMaterial) => void;
  onStartQuiz: (material: StudyMaterial) => void;
  onManage: (material: StudyMaterial) => void;
  renameTarget: StudyMaterial | null;
  deleteTarget: StudyMaterial | null;
  onRenameSave: (title: string, description: string) => void;
  onRenameClose: () => void;
  onDeleteConfirm: () => void;
  onDeleteClose: () => void;
}

export default function LibraryView({
  subjects,
  materials,
  allMaterials,
  onNewMaterial,
  onOpen,
  onOpenSubject,
  onRename,
  onDelete,
  onStartQuiz,
  onManage,
  renameTarget,
  deleteTarget,
  onRenameSave,
  onRenameClose,
  onDeleteConfirm,
  onDeleteClose,
}: LibraryViewProps) {
  const totalCount = allMaterials.length;
  const description = `${subjects.length} ${subjects.length === 1 ? 'subject' : 'subjects'} · ${totalCount} ${totalCount === 1 ? 'material' : 'materials'}`;

  return (
    <Page
      title="Study Library"
      description={description}
      actions={
        <Button
          label="New Material"
          variant="primary"
          icon={<Plus size={18} />}
          onClick={onNewMaterial}
        >
          New Material
        </Button>
      }
    >
      {/* Subjects Grid */}
      {subjects.length > 0 && (
        <div {...stylex.props(localStyles.section)}>
          <div {...stylex.props(localStyles.sectionHeader)}>
            <h2 {...stylex.props(localStyles.sectionTitle)}>Subjects</h2>
          </div>
          <div {...stylex.props(localStyles.subjectsGrid)}>
            {subjects.map((subject) => {
              const subjectMaterialCount = allMaterials.filter(
                (m) => m.subjectId === subject.id,
              ).length;
              return (
                <Card key={subject.id}>
                  <div
                    {...stylex.props(localStyles.subjectCard)}
                    onClick={() => onOpenSubject(subject.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onOpenSubject(subject.id);
                    }}
                  >
                    <div {...stylex.props(localStyles.subjectIcon)}>
                      <GraduationCap size={20} />
                    </div>
                    <h3 {...stylex.props(localStyles.subjectTitle)}>{subject.title}</h3>
                    {subject.description && (
                      <p {...stylex.props(localStyles.subjectDescription)}>
                        {subject.description}
                      </p>
                    )}
                    <div {...stylex.props(localStyles.subjectMeta)}>
                      <span>{subjectMaterialCount} materials</span>
                      <ArrowRight size={12} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Uncategorized Materials */}
      {materials.length > 0 && (
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
            onRename={onRename}
            onDelete={onDelete}
            onStartQuiz={onStartQuiz}
            onManage={onManage}
          />
        </div>
      )}

      {/* Empty State — only shown when nothing exists at all */}
      {subjects.length === 0 && materials.length === 0 && (
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
      {renameTarget && (
        <RenameMaterialModal
          initialTitle={renameTarget.title}
          initialDescription={renameTarget.description ?? ''}
          onSave={onRenameSave}
          onClose={onRenameClose}
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
