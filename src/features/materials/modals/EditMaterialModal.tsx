import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { Button } from '../../../shared/ui/Button/Button';
import { MaterialFormFields } from '../components/MaterialFormFields';
import { styles } from '../styles/library.stylex';
import { normalizeTags } from '../../../shared/utils/tags';

interface EditMaterialModalProps {
  initialTitle: string;
  initialDescription: string;
  /** Initial tag list (material.tags ?? []). */
  initialTags?: string[];
  onSave: (title: string, description: string, tags?: string[]) => void;
  onClose: () => void;
}

export default function EditMaterialModal({
  initialTitle,
  initialDescription,
  initialTags = [],
  onSave,
  onClose,
}: EditMaterialModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [tags, setTags] = useState<string[]>(initialTags);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSave(
        title.trim(),
        description.trim(),
        // Empty list clears tags (normalizeTags collapses [] to undefined, which the
        // repository treats as "leave unchanged" — so emit an explicit empty array).
        normalizeTags(tags) ?? [],
      );
    }
  };

  return (
    <Dialog isOpen onClose={onClose} title="Edit Material" width={460}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginTop: 16,
        }}
      >
        <MaterialFormFields
          title={title}
          onTitleChange={setTitle}
          description={description}
          onDescriptionChange={setDescription}
          tags={tags}
          onTagsChange={setTags}
        />

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
