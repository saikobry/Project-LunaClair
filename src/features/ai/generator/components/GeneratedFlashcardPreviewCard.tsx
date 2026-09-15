import React, { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Check, Edit2, AlertCircle, Layers } from 'lucide-react';
import type { GeneratedFlashcardDraft } from '../../../../domain/generator/models/generator.types';

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
    backgroundColor: '#ede9fe',
    color: '#6d28d9',
  },
  sidesContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 10,
  },
  sideBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 10px',
    borderRadius: 6,
    backgroundColor: 'var(--color-background-muted)',
  },
  sideLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--color-text-secondary)',
  },
  sideText: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--color-text-primary, #111827)',
    margin: 0,
    lineHeight: 1.4,
  },
  input: {
    width: '100%',
    padding: '6px 8px',
    fontSize: 13,
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text-primary)',
    boxSizing: 'border-box',
  },
  explanationRow: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
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

export interface GeneratedFlashcardPreviewCardProps {
  draft: GeneratedFlashcardDraft;
  isSelected: boolean;
  onToggleSelect: () => void;
  onUpdateDraft: (updated: GeneratedFlashcardDraft) => void;
}

interface EditFlashcardFormProps {
  initialFront: string;
  initialBack: string;
  initialExplanation?: string;
  onSave: (front: string, back: string, explanation?: string) => void;
  onCancel: () => void;
}

const EditFlashcardForm: React.FC<EditFlashcardFormProps> = ({
  initialFront,
  initialBack,
  initialExplanation,
  onSave,
  onCancel,
}) => {
  const [front, setFront] = useState(initialFront);
  const [back, setBack] = useState(initialBack);
  const [explanation, setExplanation] = useState(initialExplanation ?? '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <label htmlFor="edit-flashcard-front" style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          FRONT
        </label>
        <input
          id="edit-flashcard-front"
          type="text"
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="Card front / prompt..."
          {...stylex.props(styles.input)}
        />
      </div>
      <div>
        <label htmlFor="edit-flashcard-back" style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          BACK
        </label>
        <input
          id="edit-flashcard-back"
          type="text"
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Card back / answer..."
          {...stylex.props(styles.input)}
        />
      </div>
      <div>
        <label htmlFor="edit-flashcard-explanation" style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          EXPLANATION (OPTIONAL)
        </label>
        <input
          id="edit-flashcard-explanation"
          type="text"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Context / mnemonic..."
          {...stylex.props(styles.input)}
        />
      </div>
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
          onClick={() => onSave(front.trim() || initialFront, back.trim() || initialBack, explanation.trim() || undefined)}
          style={{ padding: '4px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 4, backgroundColor: 'var(--color-accent)', color: '#fff', border: 'none' }}
        >
          Save
        </button>
      </div>
    </div>
  );
};

export const GeneratedFlashcardPreviewCard: React.FC<GeneratedFlashcardPreviewCardProps> = ({
  draft,
  isSelected,
  onToggleSelect,
  onUpdateDraft,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const isValid = Boolean(draft.front.trim() && draft.back.trim());

  const handleSaveEdit = (newFront: string, newBack: string, newExplanation?: string) => {
    onUpdateDraft({
      ...draft,
      front: newFront,
      back: newBack,
      explanation: newExplanation,
    });
    setIsEditing(false);
  };

  return (
    <div
      {...stylex.props(
        styles.card,
        isSelected && styles.cardSelected,
        !isValid && styles.cardInvalid,
      )}
    >
      <div {...stylex.props(styles.headerRow)}>
        <div {...stylex.props(styles.leftMeta)}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            aria-label={`Select flashcard: ${draft.front}`}
            {...stylex.props(styles.checkbox)}
          />
          <span {...stylex.props(styles.badge)}>
            <Layers size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Flashcard
          </span>
          {draft.sourceSection && (
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {draft.sourceSection}
            </span>
          )}
        </div>

        <div {...stylex.props(styles.rightMeta)}>
          {isValid ? (
            <span {...stylex.props(styles.statusValid)}>
              <Check size={13} /> Ready
            </span>
          ) : (
            <span {...stylex.props(styles.statusInvalid)}>
              <AlertCircle size={13} /> Needs text
            </span>
          )}

          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              title="Edit card"
              {...stylex.props(styles.iconButton)}
            >
              <Edit2 size={14} />
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <EditFlashcardForm
          initialFront={draft.front}
          initialBack={draft.back}
          initialExplanation={draft.explanation}
          onSave={handleSaveEdit}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <div {...stylex.props(styles.sidesContainer)}>
          <div {...stylex.props(styles.sideBox)}>
            <span {...stylex.props(styles.sideLabel)}>Front</span>
            <p {...stylex.props(styles.sideText)}>{draft.front}</p>
          </div>
          <div {...stylex.props(styles.sideBox)}>
            <span {...stylex.props(styles.sideLabel)}>Back</span>
            <p {...stylex.props(styles.sideText)}>{draft.back}</p>
          </div>
        </div>
      )}

      {draft.explanation && !isEditing && (
        <div {...stylex.props(styles.explanationRow)}>
          💡 {draft.explanation}
        </div>
      )}
    </div>
  );
};
