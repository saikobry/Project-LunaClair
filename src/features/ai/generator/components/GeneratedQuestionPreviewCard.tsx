import React, { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Check, Edit2, AlertCircle } from 'lucide-react';
import type { GeneratedQuestionDraft } from '../../../../domain/generator/models/generator.types';
import { validateQuestionDraft } from '../../../../domain/generator/validation/questionDraftValidation';
import {
  DIFFICULTY_APPEARANCE,
  QUESTION_TYPE_APPEARANCE,
} from '../../../quiz/utils/quizBadgeAppearance';

const styles = stylex.create({
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background-surface, #ffffff)',
    transition: 'border-color 0.15s ease',
  },
  cardSelected: {
    borderColor: 'var(--color-accent)',
    backgroundColor: 'var(--color-background-surface-hover, #fafafa)',
  },
  cardInvalid: {
    borderColor: 'var(--color-error)',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  leftMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  rightMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: 'pointer',
    accentColor: 'var(--color-accent)',
  },
  badge: {
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  promptText: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--color-text-primary, #111827)',
    margin: 0,
    lineHeight: 1.4,
  },
  promptInput: {
    width: '100%',
    padding: '6px 8px',
    fontSize: 13,
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text-primary)',
    boxSizing: 'border-box',
  },
  payloadSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 10px',
    borderRadius: 6,
    backgroundColor: 'var(--color-background-muted)',
    fontSize: 13,
  },
  choiceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--color-text-secondary)',
  },
  choiceRowCorrect: {
    fontWeight: 600,
    color: 'var(--color-success)',
  },
  explanationRow: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
    marginTop: 2,
  },
  iconButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 4,
    color: 'var(--color-text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusValid: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-success)',
  },
  statusInvalid: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-error)',
  },
});

export interface GeneratedQuestionPreviewCardProps {
  draft: GeneratedQuestionDraft;
  isSelected: boolean;
  onToggleSelect: () => void;
  onUpdateDraft: (updated: GeneratedQuestionDraft) => void;
}

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple Choice',
  multiple_select: 'Multiple Select',
  true_false: 'True / False',
  identification: 'Identification',
  fill_in_blank: 'Fill in Blank',
};

interface EditQuestionFormProps {
  initialPrompt: string;
  initialExplanation?: string;
  onSave: (prompt: string, explanation?: string) => void;
  onCancel: () => void;
}

const EditQuestionForm: React.FC<EditQuestionFormProps> = ({
  initialPrompt,
  initialExplanation,
  onSave,
  onCancel,
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [explanation, setExplanation] = useState(initialExplanation ?? '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor="edit-question-prompt" style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
        QUESTION PROMPT
      </label>
      <input
        id="edit-question-prompt"
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Edit prompt text..."
        {...stylex.props(styles.promptInput)}
      />
      <label htmlFor="edit-question-explanation" style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
        EXPLANATION (OPTIONAL)
      </label>
      <input
        id="edit-question-explanation"
        type="text"
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        placeholder="Edit explanation (optional)..."
        {...stylex.props(styles.promptInput)}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 4, border: '1px solid var(--color-border)' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(prompt.trim() || initialPrompt, explanation.trim() || undefined)}
          style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 4, backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none' }}
        >
          Save
        </button>
      </div>
    </div>
  );
};

function CardValidationControls({
  isValid,
  error,
  isEditing,
  onEdit,
}: {
  isValid: boolean;
  error?: string;
  isEditing: boolean;
  onEdit: () => void;
}) {
  return (
    <div {...stylex.props(styles.rightMeta)}>
      {isValid ? (
        <span {...stylex.props(styles.statusValid)}>
          <Check size={13} /> Ready
        </span>
      ) : (
        <span {...stylex.props(styles.statusInvalid)} title={error}>
          <AlertCircle size={13} /> Invalid
        </span>
      )}

      {!isEditing && (
        <button
          type="button"
          onClick={onEdit}
          title="Edit prompt"
          {...stylex.props(styles.iconButton)}
        >
          <Edit2 size={14} />
        </button>
      )}
    </div>
  );
}

function ChoiceList({ keyPrefix, choices, isCorrectAt }: { keyPrefix: string; choices: string[]; isCorrectAt: (idx: number) => boolean }) {
  return (
    <div>
      {choices.map((choice, idx) => {
        const isCorrect = isCorrectAt(idx);
        return (
          <div
            key={`${keyPrefix}-${idx}-${choice}`}
            {...stylex.props(styles.choiceRow, isCorrect && styles.choiceRowCorrect)}
          >
            <span>{isCorrect ? '✓' : '•'}</span>
            <span>{choice}</span>
          </div>
        );
      })}
    </div>
  );
}

function PayloadPreview({ payload, explanation }: { payload: GeneratedQuestionDraft['payload']; explanation?: string }) {
  let body: React.ReactNode = null;

  switch (payload.type) {
    case 'multiple_choice':
      body = <ChoiceList keyPrefix="choice-mc" choices={payload.choices} isCorrectAt={(idx) => idx === payload.correctIndex} />;
      break;
    case 'multiple_select': {
      const correctSet = new Set(payload.correctIndices);
      body = <ChoiceList keyPrefix="choice-ms" choices={payload.choices} isCorrectAt={(idx) => correctSet.has(idx)} />;
      break;
    }
    case 'true_false':
      body = (
        <div style={{ fontWeight: 600 }}>
          Correct Answer:{' '}
          <span style={{ color: payload.correctAnswer ? 'var(--color-success)' : 'var(--color-error)' }}>
            {payload.correctAnswer ? 'True' : 'False'}
          </span>
        </div>
      );
      break;
    case 'identification':
      body = (
        <div>
          <strong>Answer:</strong> {payload.correctAnswer}
          {payload.acceptedAlternatives && payload.acceptedAlternatives.length > 0 && (
            <span style={{ color: 'var(--color-text-secondary)', marginLeft: 6 }}>
              (Also accepted: {payload.acceptedAlternatives.join(', ')})
            </span>
          )}
        </div>
      );
      break;
    case 'fill_in_blank':
      body = (
        <div>
          <div>
            <strong>Template:</strong> <code>{payload.template}</code>
          </div>
          <div style={{ marginTop: 4 }}>
            <strong>Blanks:</strong> {payload.blanks.join(', ')}
          </div>
        </div>
      );
      break;
  }

  return (
    <div {...stylex.props(styles.payloadSection)}>
      {body}
      {explanation && (
        <div {...stylex.props(styles.explanationRow)}>
          💡 {explanation}
        </div>
      )}
    </div>
  );
}

export const GeneratedQuestionPreviewCard: React.FC<GeneratedQuestionPreviewCardProps> = ({
  draft,
  isSelected,
  onToggleSelect,
  onUpdateDraft,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const validation = validateQuestionDraft(draft);
  const typeMeta = QUESTION_TYPE_APPEARANCE[draft.type] ?? {
    bg: 'var(--color-background-muted)',
    fg: 'var(--color-text-secondary)',
  };
  const diffMeta = DIFFICULTY_APPEARANCE[draft.difficulty] ?? {
    bg: 'var(--color-background-muted)',
    fg: 'var(--color-text-secondary)',
  };

  const handleSaveEdit = (newPrompt: string, newExplanation?: string) => {
    onUpdateDraft({
      ...draft,
      prompt: newPrompt,
      explanation: newExplanation,
    });
    setIsEditing(false);
  };

  return (
    <div
      {...stylex.props(
        styles.card,
        isSelected && styles.cardSelected,
        !validation.success && styles.cardInvalid,
      )}
    >
      <div {...stylex.props(styles.headerRow)}>
        <div {...stylex.props(styles.leftMeta)}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            aria-label={`Select question: ${draft.prompt}`}
            {...stylex.props(styles.checkbox)}
          />
          <span
            {...stylex.props(styles.badge)}
            style={{ backgroundColor: typeMeta.bg, color: typeMeta.fg }}
          >
            {TYPE_LABELS[draft.type] ?? draft.type}
          </span>
          <span
            {...stylex.props(styles.badge)}
            style={{ backgroundColor: diffMeta.bg, color: diffMeta.fg }}
          >
            {draft.difficulty}
          </span>
        </div>

        <CardValidationControls
          isValid={validation.success}
          error={validation.success ? undefined : validation.error}
          isEditing={isEditing}
          onEdit={() => setIsEditing(true)}
        />
      </div>

      {isEditing ? (
        <EditQuestionForm
          initialPrompt={draft.prompt}
          initialExplanation={draft.explanation}
          onSave={handleSaveEdit}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <p {...stylex.props(styles.promptText)}>{draft.prompt}</p>
      )}

      <PayloadPreview payload={draft.payload} explanation={draft.explanation} />
    </div>
  );
};
