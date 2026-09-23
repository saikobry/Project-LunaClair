import { useState, type FormEvent } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Trash2 } from 'lucide-react';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { Button } from '../../../shared/ui/Button/Button';
import type { Collection } from '../../../domain/collections/models/Collection';
import { CollectionAppearancePicker } from '../components/CollectionAppearancePicker';
import { collectionModalStyles as styles } from './collectionModal.stylex';

export interface EditCollectionModalProps {
    collection: Collection;
    isOpen: boolean;
    onSave: (id: string, input: { title?: string; description?: string; icon?: string; color?: string }) => void;
    onClose: () => void;
    onDelete?: () => void;
}

export function EditCollectionModal({ collection, isOpen, onSave, onClose, onDelete }: EditCollectionModalProps) {
    const [color, setColor] = useState<string | undefined>(collection.color);
    const [icon, setIcon] = useState<string | undefined>(collection.icon);

    // Re-seed the draft when the modal opens or a different collection is targeted
    // (guarded render-phase adjustment — the documented React pattern).
    const [prevKey, setPrevKey] = useState(`${isOpen}:${collection.id}`);
    const nextKey = `${isOpen}:${collection.id}`;
    if (nextKey !== prevKey) {
        setPrevKey(nextKey);
        if (isOpen) {
            setColor(collection.color);
            setIcon(collection.icon);
        }
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        submitDraft();
    };

    /**
     * Footer submit bridges the docked `Dialog footer=` action back into the
     * body form: the footer lives outside the `<form>` (sticky slot), so the
     * primary button reuses the same save path as `handleSubmit`.
     */
    const handleFooterSubmit = () => {
        submitDraft();
    };

    function submitDraft() {
        onSave(collection.id, {
            icon,
            color,
        });
    }

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Customize Appearance"
            width={440}
            purpose="form"
            footer={
                <div {...stylex.props(styles.modalFooter)}>
                    {onDelete && (
                        <Button
                            label="Delete Collection"
                            variant="danger"
                            icon={<Trash2 size={15} />}
                            onClick={onDelete}
                        />
                    )}
                    <div {...stylex.props(styles.modalActions)}>
                        <Button label="Cancel" variant="secondary" onClick={onClose} />
                        <Button
                            label="Save Changes"
                            variant="primary"
                            onClick={handleFooterSubmit}
                        />
                    </div>
                </div>
            }
        >
            <form onSubmit={handleSubmit} {...stylex.props(styles.form)}>
                <CollectionAppearancePicker
                    color={color}
                    icon={icon}
                    onColorChange={setColor}
                    onIconChange={setIcon}
                    labelIds={{ color: 'edit-collection-color-label', icon: 'edit-collection-icon-label' }}
                />

            </form>
        </Dialog>
    );
}

EditCollectionModal.displayName = 'EditCollectionModal';

export default EditCollectionModal;
