import * as stylex from '@stylexjs/stylex';
import { Plus, BookHeart } from 'lucide-react';
import type { StudyMaterial } from '../../domain/library';
import { styles } from './styles/library.stylex';
import MaterialGrid from './components/MaterialGrid';
import RenameMaterialModal from './components/RenameMaterialModal';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';

interface LibraryViewProps {
  materials: StudyMaterial[];
  onNewMaterial: () => void;
  onOpen: (material: StudyMaterial) => void;
  onRename: (material: StudyMaterial) => void;
  onDelete: (material: StudyMaterial) => void;
  renameTarget: StudyMaterial | null;
  deleteTarget: StudyMaterial | null;
  onRenameSave: (title: string, description: string) => void;
  onRenameClose: () => void;
  onDeleteConfirm: () => void;
  onDeleteClose: () => void;
}

export default function LibraryView({
  materials,
  onNewMaterial,
  onOpen,
  onRename,
  onDelete,
  renameTarget,
  deleteTarget,
  onRenameSave,
  onRenameClose,
  onDeleteConfirm,
  onDeleteClose,
}: LibraryViewProps) {
  return (
    <div {...stylex.props(styles.screen)}>
      {/* Header */}
      <div {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.headerLeft)}>
          <h1 {...stylex.props(styles.title)}>Study Library</h1>
          <p {...stylex.props(styles.subtitle)}>
            {materials.length} {materials.length === 1 ? 'material' : 'materials'}
          </p>
        </div>
        <button
          type="button"
          {...stylex.props(styles.newButton)}
          onClick={onNewMaterial}
        >
          <Plus size={18} />
          New Material
        </button>
      </div>

      {/* Content */}
      {materials.length > 0 ? (
        <MaterialGrid
          materials={materials}
          onOpen={onOpen}
          onRename={onRename}
          onDelete={onDelete}
        />
      ) : (
        <div {...stylex.props(styles.emptyState)}>
          <div {...stylex.props(styles.emptyIcon)}>
            <BookHeart size={64} />
          </div>
          <h2 {...stylex.props(styles.emptyTitle)}>Your library is empty</h2>
          <p {...stylex.props(styles.emptyText)}>
            Create your first study material to get started. You can add content from markdown
            files, PDFs, or generate quizzes and flashcards.
          </p>
          <button
            type="button"
            {...stylex.props(styles.newButton)}
            onClick={onNewMaterial}
          >
            <Plus size={18} />
            Create Material
          </button>
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
    </div>
  );
}
