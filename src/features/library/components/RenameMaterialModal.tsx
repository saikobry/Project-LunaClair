import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as stylex from '@stylexjs/stylex';
import { styles } from '../styles/library.stylex';

interface RenameMaterialModalProps {
  initialTitle: string;
  initialDescription: string;
  onSave: (title: string, description: string) => void;
  onClose: () => void;
}

export default function RenameMaterialModal({
  initialTitle,
  initialDescription,
  onSave,
  onClose,
}: RenameMaterialModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSave(title.trim(), description.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return createPortal(
    <div {...stylex.props(styles.overlay)} onKeyDown={handleKeyDown}>
      <div {...stylex.props(styles.modal)} onClick={(e) => e.stopPropagation()}>
        <h2 {...stylex.props(styles.modalTitle)}>Edit Material</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div {...stylex.props(styles.fieldGroup)}>
            <label {...stylex.props(styles.label)} htmlFor="rename-title">
              Title
            </label>
            <input
              ref={inputRef}
              id="rename-title"
              {...stylex.props(styles.input)}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter material title"
              required
            />
          </div>

          <div {...stylex.props(styles.fieldGroup)}>
            <label {...stylex.props(styles.label)} htmlFor="rename-desc">
              Description
            </label>
            <textarea
              id="rename-desc"
              {...stylex.props(styles.textarea)}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description (optional)"
              rows={3}
            />
          </div>

          <div {...stylex.props(styles.modalActions)}>
            <button type="button" {...stylex.props(styles.btnSecondary)} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" {...stylex.props(styles.btnPrimary)} disabled={!title.trim()}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
