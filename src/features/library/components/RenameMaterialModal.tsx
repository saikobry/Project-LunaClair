import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Dialog } from '../../../shared/ui/Dialog';
import { Input } from '../../../shared/ui/Input';
import { Button } from '../../../shared/ui/Button';
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
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSave(title.trim(), description.trim());
    }
  };

  return (
    <Dialog isOpen onClose={onClose} title="Edit Material" width={420}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginTop: 16,
        }}
      >
        <div {...stylex.props(styles.fieldGroup)}>
          <Input
            label="Title"
            value={title}
            onChange={(value) => setTitle(value)}
            placeholder="Enter material title"
            autoFocus
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
          <Button label="Cancel" variant="secondary" onClick={onClose} />
          <Button
            label="Save"
            variant="primary"
            type="submit"
            isDisabled={!title.trim()}
          />
        </div>
      </form>
    </Dialog>
  );
}
