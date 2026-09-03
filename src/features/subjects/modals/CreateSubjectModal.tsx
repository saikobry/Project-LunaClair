import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { Input } from '../../../shared/ui/Input';
import { Button } from '../../../shared/ui/Button/Button';
import { styles } from '../styles/subjectModal.stylex';

interface CreateSubjectModalProps {
  onSave: (title: string, description: string) => void;
  onClose: () => void;
}

export default function CreateSubjectModal({
  onSave,
  onClose,
}: CreateSubjectModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSave(title.trim(), description.trim());
    }
  };

  return (
    <Dialog isOpen onClose={onClose} title="New Subject" width={420}>
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
            placeholder="e.g. Biology 101"
            autoFocus
          />
        </div>

        <div {...stylex.props(styles.fieldGroup)}>
          <label {...stylex.props(styles.label)} htmlFor="subject-desc">
            Description
          </label>
          <textarea
            id="subject-desc"
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
            label="Create Subject"
            variant="primary"
            type="submit"
            isDisabled={!title.trim()}
          />
        </div>
      </form>
    </Dialog>
  );
}
