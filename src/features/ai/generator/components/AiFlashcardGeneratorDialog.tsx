import React, { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Input } from '../../../../shared/ui/Input/Input';
import { GeneratedFlashcardPreviewCard } from './GeneratedFlashcardPreviewCard';
import { SynthesisModelControl } from './SynthesisModelControl';
import { AiBatchGeneratorShell } from './AiBatchGeneratorShell';
import { useAiFlashcardGenerator } from '../hooks/useAiFlashcardGenerator';

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

export interface AiFlashcardGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  materialId: string;
  materialTitle: string;
  onSuccess?: (createdCount: number) => void;
}

export const AiFlashcardGeneratorDialog: React.FC<AiFlashcardGeneratorDialogProps> = ({
  isOpen,
  onClose,
  materialId,
  materialTitle,
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
  } = useAiFlashcardGenerator();

  if (!isOpen) return null;

  const handleGenerate = async () => {
    // Belt-and-braces with the disabled button: nothing is sent when there is no model to send on.
    if (isAiUnavailable) return;
    await generate({
      materialId,
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

  return (
    <AiBatchGeneratorShell
      title="Generate Flashcards with AI"
      status={status}
      phaseMessage={phaseMessage}
      error={errorMessage}
      singular="flashcard"
      plural="flashcards"
      acceptDestination="Deck"
      isAiUnavailable={isAiUnavailable}
      errorFallback="An error occurred during flashcard generation."
      doneDescription={
        <>
          Added {savedCards.length} flashcards to your deck. Ready for spaced repetition
          practice!
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
            Synthesize key definitions and conceptual flashcards from{' '}
            <strong>{materialTitle}</strong>.
          </div>

          <SynthesisModelControl
            isAiUnavailable={isAiUnavailable}
            models={models}
            defaultModelId={defaultModelId}
            isAiDisabled={isAiDisabled}
            selectedModelId={selectedModelId}
            onSelectModel={selectModel}
            noun="flashcards"
          />

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
            <Input
              label="Topic Focus (Optional)"
              value={focusTopic}
              onChange={setFocusTopic}
              placeholder="e.g. Focus on definitions and enzyme names..."
            />
          </div>
        </>
      }
      renderPreviewList={() => (
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
      )}
    />
  );
};
