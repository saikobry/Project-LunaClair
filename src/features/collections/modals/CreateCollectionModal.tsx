import { useState, type FormEvent } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ArrowRight } from 'lucide-react';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { Input } from '../../../shared/ui/Input/Input';
import { TextArea } from '../../../shared/ui/TextArea/TextArea';
import { Button } from '../../../shared/ui/Button/Button';
import { CollectionAppearancePicker } from '../components/CollectionAppearancePicker';
import { collectionModalStyles as styles } from './collectionModal.stylex';

export interface CreateCollectionModalProps {
    isOpen: boolean;
    onSave: (input: { title: string; description?: string; icon?: string; color?: string }) => void;
    onClose: () => void;
}

export function CreateCollectionModal({ isOpen, onSave, onClose }: CreateCollectionModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState<string | undefined>(undefined);
    const [icon, setIcon] = useState<string | undefined>(undefined);

    // Reset any stale draft when the modal opens (guarded render-phase adjustment —
    // the documented React pattern, same as ConflictDraftsModal).
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen && !prevIsOpen) {
        setPrevIsOpen(true);
        setTitle('');
        setDescription('');
        setColor(undefined);
        setIcon(undefined);
    } else if (!isOpen && prevIsOpen) {
        setPrevIsOpen(false);
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        submitDraft();
    };

    /**
     * Footer submit bridges the docked `Dialog footer=` action back into the
     * body form: the footer lives outside the `<form>` (sticky slot), so the
     * primary button reuses the same trimmed-title guard as `handleSubmit`.
     */
    const handleFooterSubmit = () => {
        submitDraft();
    };

    function submitDraft() {
        const trimmed = title.trim();
        if (!trimmed) return;
        onSave({
            title: trimmed,
            description: description.trim() || undefined,
            icon,
            color,
        });
    }

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="New Collection"
            width={460}
            purpose="form"
            footer={
                <div {...stylex.props(styles.modalFooter)}>
                    <div {...stylex.props(styles.modalActions)}>
                        <Button label="Cancel" variant="secondary" onClick={onClose} />
                        <Button
                            label="Create Collection"
                            variant="primary"
                            icon={<ArrowRight size={15} />}
                            isDisabled={!title.trim()}
                            onClick={handleFooterSubmit}
                            style={{ flex: 1 }}
                        />
                    </div>
                </div>
            }
        >
            <form onSubmit={handleSubmit} {...stylex.props(styles.form)}>
                <Input
                    label="Title"
                    value={title}
                    onChange={setTitle}
                    placeholder="Enter collection title"
                    autoFocus
                />

                <TextArea
                    label="Description (optional)"
                    value={description}
                    onChange={setDescription}
                    placeholder="Brief description (optional)"
                    rows={3}
                />

                <CollectionAppearancePicker
                    color={color}
                    icon={icon}
                    onColorChange={setColor}
                    onIconChange={setIcon}
                />

            </form>
        </Dialog>
    );
}

CreateCollectionModal.displayName = 'CreateCollectionModal';

export default CreateCollectionModal;
