import * as stylex from '@stylexjs/stylex';
import { FileQuestion } from 'lucide-react';
import { useMaterialWriterState } from '../hooks/useMaterialWriterState';
import { WriterEditor } from './WriterEditor';
import { WriterActionBar } from './WriterActionBar';
import { UnsavedChangesModal } from './UnsavedChangesModal';
import { ErrorState } from '../../../shared/ui/ErrorState/ErrorState';

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    boxSizing: 'border-box',
  },
  rawEditorArea: {
    width: '100%',
    height: 580,
    fontFamily: 'ui-monospace, Consolas, Monaco, monospace',
    fontSize: 13,
    lineHeight: 1.55,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background-code)',
    color: 'var(--color-text-code)',
    boxSizing: 'border-box',
    outline: 'none',
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    color: 'var(--color-text-secondary)',
    fontSize: 14,
  },
});

export interface MaterialWriterTabProps {
  materialId: string;
}

interface UnsavedChangesModalProps {
  isOpen: boolean;
  materialTitle?: string;
  onStay: () => void;
  onDiscard: () => void;
}

function WriterLoadingState({ isOpen, materialTitle, onStay, onDiscard }: UnsavedChangesModalProps) {
  return (
    <>
      <div {...stylex.props(styles.loadingState)}>Loading document editor...</div>
      <UnsavedChangesModal
        isOpen={isOpen}
        onStay={onStay}
        onDiscard={onDiscard}
        materialTitle={materialTitle}
      />
    </>
  );
}

function WriterErrorState({ isOpen, materialTitle, onStay, onDiscard }: UnsavedChangesModalProps) {
  return (
    <>
      <ErrorState
        icon={<FileQuestion size={28} />}
        title="Could not load document for editing"
        description="The material or its associated document could not be found."
      />
      <UnsavedChangesModal
        isOpen={isOpen}
        onStay={onStay}
        onDiscard={onDiscard}
        materialTitle={materialTitle}
      />
    </>
  );
}

export function MaterialWriterTab({ materialId }: MaterialWriterTabProps) {
  const state = useMaterialWriterState(materialId);
  const { material, showUnsavedModal, saveStatus, draft, handleStay, handleConfirmDiscardAndSwitch } = state;

  const modalProps: UnsavedChangesModalProps = {
    isOpen: showUnsavedModal,
    materialTitle: material?.title,
    onStay: handleStay,
    onDiscard: handleConfirmDiscardAndSwitch,
  };

  if (state.isLoading) {
    return <WriterLoadingState {...modalProps} />;
  }

  if (state.hasError) {
    return <WriterErrorState {...modalProps} />;
  }

  return (
    <div {...stylex.props(styles.root)}>
      <WriterActionBar
        saveStatus={saveStatus}
        isRawMode={draft.isRawMode}
        isDirty={draft.isDirty}
        isSaving={saveStatus === 'saving'}
        copied={draft.copied}
        onToggleMode={draft.handleToggleMode}
        onCopy={draft.handleCopyMarkdown}
        onDownload={draft.handleDownload}
        onDiscard={draft.handleDiscard}
        onSave={draft.handleSave}
      />

      {!draft.isRawMode ? (
        <WriterEditor
          key={`${material!.id}-${draft.editorKey}`}
          initialMarkdown={draft.draftMarkdown}
          onChange={draft.handleEditorChange}
        />
      ) : (
        <textarea
          {...stylex.props(styles.rawEditorArea)}
          value={draft.draftMarkdown}
          onChange={(e) => draft.setDraftMarkdown(e.target.value)}
          placeholder="Type or paste markdown here..."
          aria-label="Raw Markdown Content"
        />
      )}

      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onStay={handleStay}
        onDiscard={handleConfirmDiscardAndSwitch}
        materialTitle={material?.title}
      />
    </div>
  );
}
