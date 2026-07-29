import { useState, type KeyboardEvent, type DragEvent } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  Plus,
  BookHeart,
  GraduationCap,
  ArrowRight,
  SquarePen,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { DropdownMenuItem } from '@astryxdesign/core/DropdownMenu';
import type { StudyMaterial } from '../../domain/library';
import type { Subject } from '../../domain/library';
import type { Term } from '../../domain/library';
import { Page } from '../../shared/ui/Page';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { styles } from './styles/library.stylex';
import { ActionMenu, menuItemStyles } from '../../shared/components/ActionMenu';
import MaterialGrid from './components/MaterialGrid';
import EditMaterialModal from './components/EditMaterialModal';
import EditSubjectModal from './components/EditSubjectModal';
import CreateSubjectModal from './components/CreateSubjectModal';
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
  subjectCardDragging: {
    opacity: 0.4,
    transform: 'scale(0.96)',
  },
  subjectCardDragOver: {
    boxShadow: '0 0 0 2px var(--color-accent)',
    transform: 'translateY(-2px)',
  },
  subjectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  dragHandle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 6,
    color: 'var(--color-text-disabled)',
    cursor: 'grab',
    flexShrink: 0,
    transition: 'color 0.12s ease, background-color 0.12s ease',
    ':hover': {
      color: 'var(--color-text-secondary)',
      backgroundColor: 'var(--color-background-muted)',
    },
    ':active': {
      cursor: 'grabbing',
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
  allTerms: Term[];
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
  onEditSave: (title: string, description: string, subjectId?: string | null, termId?: string | null) => void;
  onEditClose: () => void;
  onSubjectEdit: (subject: Subject) => void;
  onSubjectDelete: (subject: Subject) => void;
  onSubjectReorder: (subjectId: string, targetIndex: number) => void;
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
  subjects,
  allTerms,
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
  const description = `${subjects.length} ${subjects.length === 1 ? 'subject' : 'subjects'} · ${totalCount} ${totalCount === 1 ? 'material' : 'materials'}`;

  // ── Drag-and-drop state ────────────────────────────────────────
  const [dragSubjectId, setDragSubjectId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (subjectId: string) => (e: DragEvent) => {
    setDragSubjectId(subjectId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', subjectId);
  };

  const handleDragOver = (index: number) => (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSubjectId && index !== dragOverIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (targetIndex: number) => (e: DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) {
      onSubjectReorder(id, targetIndex);
    }
    setDragSubjectId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragSubjectId(null);
    setDragOverIndex(null);
  };

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
      {/* Subjects Grid */}
      {subjects.length > 0 && (
        <div {...stylex.props(localStyles.section)}>
          <div {...stylex.props(localStyles.sectionHeader)}>
            <h2 {...stylex.props(localStyles.sectionTitle)}>Subjects</h2>
          </div>
          <div {...stylex.props(localStyles.subjectsGrid)}>
            {subjects.map((subject, index) => {
              const subjectMaterialCount = allMaterials.filter(
                (m) => m.subjectId === subject.id,
              ).length;
              const isDragging = dragSubjectId === subject.id;
              const isDragOver = dragOverIndex === index && dragSubjectId !== subject.id;

              return (
                <Card key={subject.id}>
                  <div
                    {...stylex.props(
                      localStyles.subjectCard,
                      isDragging && localStyles.subjectCardDragging,
                      isDragOver && localStyles.subjectCardDragOver,
                    )}
                    onClick={() => onOpenSubject(subject.id)}
                    role="button"
                    tabIndex={0}
                    draggable="true"
                    onDragStart={handleDragStart(subject.id)}
                    onDragOver={handleDragOver(index)}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    onKeyDown={(e: KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') onOpenSubject(subject.id);
                    }}
                  >
                    <div {...stylex.props(localStyles.subjectHeader)}>
                      <div {...stylex.props(localStyles.subjectIcon)}>
                        <GraduationCap size={20} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div {...stylex.props(localStyles.dragHandle)}>
                          <GripVertical size={14} />
                        </div>
                        <ActionMenu>
                          <DropdownMenuItem
                            icon={<SquarePen size={14} />}
                            label="Edit"
                            description="Rename or update description"
                            onClick={() => onSubjectEdit(subject)}
                            xstyle={menuItemStyles.item}
                          />
                          <DropdownMenuItem
                            icon={<Trash2 size={14} />}
                            label="Delete"
                            description="Remove subject and unassign its materials"
                            onClick={() => onSubjectDelete(subject)}
                            xstyle={menuItemStyles.item}
                          />
                        </ActionMenu>
                      </div>
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
            onEdit={onEdit}
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
      {editTarget && (
        <EditMaterialModal
          initialTitle={editTarget.title}
          initialDescription={editTarget.description ?? ''}
          initialSubjectId={editTarget.subjectId}
          initialTermId={editTarget.termId}
          subjects={subjects}
          terms={allTerms}
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
