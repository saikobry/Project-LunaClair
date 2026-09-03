import React, { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Button } from '../../../../shared/ui/Button/Button';
import { GeneratedFlashcardPreviewCard } from './GeneratedFlashcardPreviewCard';
import { useAiFlashcardGenerator } from '../hooks/useAiFlashcardGenerator';

const styles = stylex.create({
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: 16,
    boxSizing: 'border-box',
  },
  dialog: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '90vh',
    backgroundColor: 'var(--color-background-surface, #ffffff)',
    borderRadius: 12,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--color-border)',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    color: 'var(--color-text-secondary)',
    borderRadius: 6,
  },
  body: {
    padding: 20,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  formSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  pillRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 500,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  pillActive: {
    borderColor: 'var(--color-primary, #6366f1)',
    backgroundColor: 'var(--color-primary, #6366f1)',
    color: '#ffffff',
    fontWeight: 600,
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text-primary)',
    boxSizing: 'border-box',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    gap: 16,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  reviewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    paddingBottom: 8,
    borderBottom: '1px solid var(--color-border)',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '14px 20px',
    borderTop: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background-subtle, #f9fafb)',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 6,
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    fontSize: 13,
  },
  successContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '30px 20px',
    gap: 12,
    textAlign: 'center',
  },
});

export interface AiFlashcardGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  materialId: string;
  materialTitle: string;
  documentMarkdown: string;
  onSuccess?: (createdCount: number) => void;
}

export const AiFlashcardGeneratorDialog: React.FC<AiFlashcardGeneratorDialogProps> = ({
  isOpen,
  onClose,
  materialId,
  materialTitle,
  documentMarkdown,
  onSuccess,
}) => {
  const [count, setCount] = useState<number>(8);
  const [focusTopic, setFocusTopic] = useState('');

  const {
    status,
    phaseMessage,
    drafts,
    selectedIndices,
    savedCards,
    errorMessage,
    generate,
    toggleSelect,
    selectAll,
    deselectAll,
    updateDraft,
    saveSelected,
    reset,
  } = useAiFlashcardGenerator();

  if (!isOpen) return null;

  const handleGenerate = async () => {
    await generate({
      materialId,
      documentMarkdown,
      count,
      focusTopic: focusTopic.trim() || undefined,
    });
  };

  const handleSave = async () => {
    try {
      const created = await saveSelected(materialId);
      if (onSuccess) {
        onSuccess(created.length);
      }
    } catch {
      // Error handled by hook
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isGenerating = status === 'generating' || status === 'saving';

  return (
    <div
      {...stylex.props(styles.backdrop)}
      onClick={handleClose}
      role="presentation"
    >
      <div
        {...stylex.props(styles.dialog)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-flashcard-generator-title"
      >
        {/* Header */}
        <div {...stylex.props(styles.header)}>
          <h2 id="ai-flashcard-generator-title" {...stylex.props(styles.headerTitle)}>
            <Sparkles size={18} color="var(--color-primary, #6366f1)" />
            Generate Flashcards with AI
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            {...stylex.props(styles.closeButton)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div {...stylex.props(styles.body)}>
          {status === 'idle' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Synthesize key definitions and conceptual flashcards from <strong>{materialTitle}</strong>.
              </div>

              {/* Count selection */}
              <div {...stylex.props(styles.formSection)}>
                <label {...stylex.props(styles.label)}>Number of Flashcards</label>
                <div {...stylex.props(styles.pillRow)}>
                  {[5, 8, 12, 15].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCount(n)}
                      {...stylex.props(styles.pill, count === n && styles.pillActive)}
                    >
                      {n} Cards
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional focus topic */}
              <div {...stylex.props(styles.formSection)}>
                <label {...stylex.props(styles.label)}>Topic Focus (Optional)</label>
                <input
                  type="text"
                  value={focusTopic}
                  onChange={(e) => setFocusTopic(e.target.value)}
                  placeholder="e.g. Focus on definitions and enzyme names..."
                  {...stylex.props(styles.input)}
                />
              </div>
            </>
          )}

          {isGenerating && (
            <div {...stylex.props(styles.loadingContainer)}>
              <Loader2 size={32} className="lucide-spin" color="var(--color-primary, #6366f1)" />
              <div {...stylex.props(styles.loadingText)}>{phaseMessage || 'Generating...'}</div>
            </div>
          )}

          {status === 'error' && (
            <div {...stylex.props(styles.errorBanner)}>
              <AlertCircle size={18} />
              <span>{errorMessage || 'An error occurred during flashcard generation.'}</span>
            </div>
          )}

          {status === 'review' && (
            <>
              <div {...stylex.props(styles.reviewHeader)}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  Generated {drafts.length} flashcards ({selectedIndices.size} selected)
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button label="Select All" variant="secondary" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button label="Deselect All" variant="secondary" onClick={deselectAll}>
                    Deselect All
                  </Button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {drafts.map((draft, idx) => (
                  <GeneratedFlashcardPreviewCard
                    key={draft.front}
                    draft={draft}
                    isSelected={selectedIndices.has(idx)}
                    onToggleSelect={() => toggleSelect(idx)}
                    onUpdateDraft={(updated) => updateDraft(idx, updated)}
                  />
                ))}
              </div>
            </>
          )}

          {status === 'done' && (
            <div {...stylex.props(styles.successContainer)}>
              <CheckCircle2 size={40} color="var(--color-success, #10b981)" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Flashcards Saved!</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Added {savedCards.length} flashcards to your deck. Ready for spaced repetition practice!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div {...stylex.props(styles.footer)}>
          {status === 'idle' && (
            <>
              <Button label="Cancel" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button label="Generate Flashcards" variant="primary" onClick={handleGenerate}>
                <Sparkles size={14} style={{ marginRight: 6 }} />
                Generate Flashcards
              </Button>
            </>
          )}

          {status === 'review' && (
            <>
              <Button label="Back" variant="secondary" onClick={() => reset()}>
                Back
              </Button>
              <Button
                label={`Add ${selectedIndices.size} Flashcards to Deck`}
                variant="primary"
                onClick={handleSave}
                isDisabled={selectedIndices.size === 0}
              >
                Add {selectedIndices.size} Flashcards to Deck
              </Button>
            </>
          )}

          {status === 'done' && (
            <Button label="Done" variant="primary" onClick={handleClose}>
              Done
            </Button>
          )}

          {status === 'error' && (
            <>
              <Button label="Cancel" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button label="Retry Generation" variant="primary" onClick={handleGenerate}>
                Retry Generation
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
