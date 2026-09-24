import React, { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { QuestionType } from '../../../../domain/quiz/models/QuestionType';
import type { QuestionDifficulty } from '../../../../domain/quiz/models/Question';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS } from '../../../../domain/quiz/models/questionMetadata';
import { Input } from '../../../../shared/ui/Input/Input';
import { GeneratedQuestionPreviewCard } from './GeneratedQuestionPreviewCard';
import { SynthesisModelControl } from './SynthesisModelControl';
import { AiBatchGeneratorShell } from './AiBatchGeneratorShell';
import { useAiQuestionGenerator } from '../hooks/useAiQuestionGenerator';

const styles = stylex.create({
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
});

const QUESTION_TYPE_OPTIONS: Array<{ type: QuestionType; label: string }> = QUESTION_TYPES.map(
  (type) => ({ type, label: QUESTION_TYPE_LABELS[type] }),
);

export interface AiQuestionGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  materialId: string;
  materialTitle: string;
  onSuccess?: (createdCount: number) => void;
}

export const AiQuestionGeneratorDialog: React.FC<AiQuestionGeneratorDialogProps> = ({
  isOpen,
  onClose,
  materialId,
  materialTitle,
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
    isAiUnavailable,
    models,
    defaultModelId,
    isAiDisabled,
    selectedModelId,
    selectModel,
    rejectedCount,
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
    // Belt-and-braces with the disabled button: nothing is sent when there is no model to send on.
    if (isAiUnavailable) return;
    await generate({
      materialId,
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

  return (
    <AiBatchGeneratorShell
      title="Generate Questions with AI"
      status={status}
      phaseMessage={phaseMessage}
      error={errorMessage}
      singular="question"
      plural="questions"
      acceptDestination="Bank"
      isAiUnavailable={isAiUnavailable}
      errorFallback="An error occurred during generation."
      doneDescription={
        <>
          Added {savedQuestions.length} questions to your Question Bank in{' '}
          <strong>Draft</strong> status.
        </>
      }
      totalCount={drafts.length}
      selectedCount={selectedIndices.size}
      rejectedCount={rejectedCount}
      onGenerate={handleGenerate}
      onAccept={handleSave}
      onBack={() => reset()}
      onClose={handleClose}
      onSelectAll={selectAll}
      onDeselectAll={deselectAll}
      configPanel={
        <>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Synthesize questions from <strong>{materialTitle}</strong> directly into your
            Question Bank in <strong>Draft</strong> status.
          </div>

          <SynthesisModelControl
            isAiUnavailable={isAiUnavailable}
            models={models}
            defaultModelId={defaultModelId}
            isAiDisabled={isAiDisabled}
            selectedModelId={selectedModelId}
            onSelectModel={selectModel}
            noun="questions"
          />

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
      }
      renderPreviewList={() => (
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
      )}
    />
  );
};
