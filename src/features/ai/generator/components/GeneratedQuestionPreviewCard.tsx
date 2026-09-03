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
    borderColor: 'var(--color-primary, #6366f1)',
    backgroundColor: 'var(--color-background-surface-hover, #fafafa)',
  },
  cardInvalid: {
    borderColor: 'var(--color-danger, #ef4444)',
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
    accentColor: 'var(--color-primary, #6366f1)',
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
    backgroundColor: 'var(--color-background-subtle, #f3f4f6)',
    fontSize: 13,
  },
  choiceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--color-text-secondary, #4b5563)',
  },
  choiceRowCorrect: {
    fontWeight: 600,
    color: 'var(--color-success, #10b981)',
  },
  explanationRow: {
    fontSize: 12,
    color: 'var(--color-text-secondary, #6b7280)',
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
    color: 'var(--color-success, #10b981)',
  },
  statusInvalid: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-danger, #ef4444)',
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
          style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 4, backgroundColor: 'var(--color-primary, #6366f1)', color: '#fff', border: 'none' }}
        >
          Save
        </button>
      </div>
    </div>
  );
};

export const GeneratedQuestionPreviewCard: React.FC<GeneratedQuestionPreviewCardProps> = ({
  draft,
  isSelected,
  onToggleSelect,
  onUpdateDraft,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const validation = validateQuestionDraft(draft);
  const typeMeta = QUESTION_TYPE_APPEARANCE[draft.type] ?? {
    bg: '#f3f4f6',
    fg: '#374151',
  };
  const diffMeta = DIFFICULTY_APPEARANCE[draft.difficulty] ?? {
    bg: '#f3f4f6',
    fg: '#374151',
  };

  const handleSaveEdit = (newPrompt: string, newExplanation?: string) => {
    onUpdateDraft({
      ...draft,
      prompt: newPrompt,
      explanation: newExplanation,
    });
    setIsEditing(false);
  };

  const correctIndicesSet =
    draft.payload.type === 'multiple_select'
      ? new Set(draft.payload.correctIndices)
      : null;

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

        <div {...stylex.props(styles.rightMeta)}>
          {validation.success ? (
            <span {...stylex.props(styles.statusValid)}>
              <Check size={13} /> Ready
            </span>
          ) : (
            <span {...stylex.props(styles.statusInvalid)} title={validation.error}>
              <AlertCircle size={13} /> Invalid
            </span>
          )}

          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              title="Edit prompt"
              {...stylex.props(styles.iconButton)}
            >
              <Edit2 size={14} />
            </button>
          )}
        </div>
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

      {/* Payload preview by question type */}
      <div {...stylex.props(styles.payloadSection)}>
        {draft.payload.type === 'multiple_choice' && (
          <div>
            {draft.payload.choices.map((choice, idx) => {
              const isCorrect = idx === (draft.payload as any).correctIndex;
              return (
                <div
                  key={`choice-mc-${idx}-${choice}`}
                  {...stylex.props(styles.choiceRow, isCorrect && styles.choiceRowCorrect)}
                >
                  <span>{isCorrect ? '✓' : '•'}</span>
                  <span>{choice}</span>
                </div>
              );
            })}
          </div>
        )}

        {draft.payload.type === 'multiple_select' && correctIndicesSet && (
          <div>
            {draft.payload.choices.map((choice, idx) => {
              const isCorrect = correctIndicesSet.has(idx);
              return (
                <div
                  key={`choice-ms-${idx}-${choice}`}
                  {...stylex.props(styles.choiceRow, isCorrect && styles.choiceRowCorrect)}
                >
                  <span>{isCorrect ? '✓' : '•'}</span>
                  <span>{choice}</span>
                </div>
              );
            })}
          </div>
        )}

        {draft.payload.type === 'true_false' && (
          <div style={{ fontWeight: 600 }}>
            Correct Answer:{' '}
            <span style={{ color: draft.payload.correctAnswer ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {draft.payload.correctAnswer ? 'True' : 'False'}
            </span>
          </div>
        )}

        {draft.payload.type === 'identification' && (
          <div>
            <strong>Answer:</strong> {draft.payload.correctAnswer}
            {draft.payload.acceptedAlternatives && draft.payload.acceptedAlternatives.length > 0 && (
              <span style={{ color: 'var(--color-text-secondary)', marginLeft: 6 }}>
                (Also accepted: {draft.payload.acceptedAlternatives.join(', ')})
              </span>
            )}
          </div>
        )}

        {draft.payload.type === 'fill_in_blank' && (
          <div>
            <div>
              <strong>Template:</strong> <code>{draft.payload.template}</code>
            </div>
            <div style={{ marginTop: 4 }}>
              <strong>Blanks:</strong> {draft.payload.blanks.join(', ')}
            </div>
          </div>
        )}

        {draft.explanation && (
          <div {...stylex.props(styles.explanationRow)}>
            💡 {draft.explanation}
          </div>
        )}
      </div>
    </div>
  );
};
