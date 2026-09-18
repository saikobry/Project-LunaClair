import React, { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { QuestionType } from '../../../../domain/quiz/models/QuestionType';
import type { QuestionDifficulty } from '../../../../domain/quiz/models/Question';
import { Button } from '../../../../shared/ui/Button/Button';
import { Dialog } from '../../../../shared/ui/Dialog/Dialog';
import { Input } from '../../../../shared/ui/Input/Input';
import { GeneratedQuestionPreviewCard } from './GeneratedQuestionPreviewCard';
import { useAiQuestionGenerator } from '../hooks/useAiQuestionGenerator';

const styles = stylex.create({
  body: {
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
    backgroundColor: 'var(--color-background-surface)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    transitionProperty: 'color, background-color, border-color',
    transitionDuration: '0.15s',
    transitionTimingFunction: 'ease',
    ':hover': {
      backgroundColor: 'var(--color-overlay-hover)',
      color: 'var(--color-text-primary)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  pillActive: {
    borderColor: 'var(--color-accent)',
    backgroundColor: 'var(--color-accent)',
    color: 'var(--color-on-accent)',
    fontWeight: 600,
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
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 6,
    backgroundColor: 'var(--color-error-muted)',
    color: 'var(--color-error)',
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

export interface AiQuestionGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  materialId: string;
  materialTitle: string;
  documentMarkdown: string;
  onSuccess?: (createdCount: number) => void;
}

const QUESTION_TYPE_OPTIONS: Array<{ type: QuestionType; label: string }> = [
  { type: 'multiple_choice', label: 'Multiple Choice' },
  { type: 'true_false', label: 'True / False' },
  { type: 'fill_in_blank', label: 'Fill in Blank' },
  { type: 'identification', label: 'Identification' },
  { type: 'multiple_select', label: 'Multiple Select' },
];

export const AiQuestionGeneratorDialog: React.FC<AiQuestionGeneratorDialogProps> = ({
  isOpen,
  onClose,
  materialId,
  materialTitle,
  documentMarkdown,
  onSuccess,
}) => {
  const [count, setCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | 'all'>('all');
  const [selectedTypes, setSelectedTypes] = useState<Set<QuestionType>>(
    new Set(['multiple_choice', 'true_false', 'fill_in_blank']),
  );
  const [focusTopic, setFocusTopic] = useState('');

  const {
    status,
    phaseMessage,
    drafts,
    selectedIndices,
    savedQuestions,
    errorMessage,
    generate,
    toggleSelect,
    selectAll,
    deselectAll,
    updateDraft,
    saveSelected,
    reset,
  } = useAiQuestionGenerator();

  if (!isOpen) return null;

  const toggleType = (t: QuestionType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        if (next.size > 1) next.delete(t); // Keep at least 1 type
      } else {
        next.add(t);
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    await generate({
      materialId,
      documentMarkdown,
      count,
      difficulty,
      types: Array.from(selectedTypes),
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
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Generate Questions with AI"
      width={680}
      footer={
        <div {...stylex.props(styles.footer)}>
          {status === 'idle' && (
            <>
              <Button label="Cancel" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button label="Generate Questions" variant="primary" onClick={handleGenerate}>
                <Sparkles size={14} style={{ marginRight: 6 }} />
                Generate Questions
              </Button>
            </>
          )}

          {status === 'review' && (
            <>
              <Button label="Back" variant="secondary" onClick={() => reset()}>
                Back
              </Button>
              <Button
                label={`Add ${selectedIndices.size} Questions to Bank`}
                variant="primary"
                onClick={handleSave}
                isDisabled={selectedIndices.size === 0}
              >
                Add {selectedIndices.size} Questions to Bank
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
      }
    >
      <div {...stylex.props(styles.body)}>
        {status === 'idle' && (
          <>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Synthesize questions from <strong>{materialTitle}</strong> directly into your
              Question Bank in <strong>Draft</strong> status.
            </div>

            {/* Count selection */}
            <div {...stylex.props(styles.formSection)}>
              <label {...stylex.props(styles.label)}>Number of Questions</label>
              <div {...stylex.props(styles.pillRow)}>
                {[3, 5, 8, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    {...stylex.props(styles.pill, count === n && styles.pillActive)}
                  >
                    {n} Questions
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty selection */}
            <div {...stylex.props(styles.formSection)}>
              <label {...stylex.props(styles.label)}>Target Difficulty</label>
              <div {...stylex.props(styles.pillRow)}>
                {(['all', 'easy', 'medium', 'hard'] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    {...stylex.props(styles.pill, difficulty === diff && styles.pillActive)}
                  >
                    {diff === 'all' ? 'Mixed' : diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Allowed Question Types */}
            <div {...stylex.props(styles.formSection)}>
              <label {...stylex.props(styles.label)}>Allowed Question Types</label>
              <div {...stylex.props(styles.pillRow)}>
                {QUESTION_TYPE_OPTIONS.map((opt) => {
                  const active = selectedTypes.has(opt.type);
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => toggleType(opt.type)}
                      {...stylex.props(styles.pill, active && styles.pillActive)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional focus topic */}
            <div {...stylex.props(styles.formSection)}>
              <Input
                label="Topic Focus (Optional)"
                value={focusTopic}
                onChange={setFocusTopic}
                placeholder="e.g. Focus specifically on action potentials..."
              />
            </div>
          </>
        )}

        {isGenerating && (
          <div {...stylex.props(styles.loadingContainer)}>
            <Loader2 size={32} className="lucide-spin" color="var(--color-accent)" />
            <div {...stylex.props(styles.loadingText)}>{phaseMessage || 'Generating...'}</div>
          </div>
        )}

        {status === 'error' && (
          <div {...stylex.props(styles.errorBanner)}>
            <AlertCircle size={18} />
            <span>{errorMessage || 'An error occurred during generation.'}</span>
          </div>
        )}

        {status === 'review' && (
          <>
            <div {...stylex.props(styles.reviewHeader)}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                Generated {drafts.length} questions ({selectedIndices.size} selected)
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
                <GeneratedQuestionPreviewCard
                  key={draft.prompt}
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
            <CheckCircle2 size={40} color="var(--color-success)" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Questions Saved!</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Added {savedQuestions.length} questions to your Question Bank in{' '}
              <strong>Draft</strong> status.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
};
