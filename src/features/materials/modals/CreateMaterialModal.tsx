import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { Button } from '../../../shared/ui/Button/Button';
import { MaterialFormFields } from '../components/MaterialFormFields';
import { styles } from '../styles/library.stylex';
import { normalizeTags } from '../../../shared/utils/tags';

interface CreateMaterialModalProps {
    onSave: (title: string, description: string, tags?: string[]) => void;
    onClose: () => void;
}

export default function CreateMaterialModal({
    onSave,
    onClose,
}: CreateMaterialModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (title.trim()) {
            onSave(
                title.trim(),
                description.trim(),
                normalizeTags(tags),
            );
        }
    };

    return (
        <Dialog isOpen onClose={onClose} title="New Material" width={460}>
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
                        label="Create Material"
                        variant="primary"
                        type="submit"
                        isDisabled={!title.trim()}
                    />
                </div>
            </form>
        </Dialog>
    );
}
