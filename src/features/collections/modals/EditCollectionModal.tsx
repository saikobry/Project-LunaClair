import { useState, type ComponentType, type FormEvent } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Trash2 } from 'lucide-react';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { Button } from '../../../shared/ui/Button/Button';
import type { Collection } from '../../../domain/collections/models/Collection';
import { COLLECTION_COLOR_PRESETS, COLLECTION_ICON_NAMES, getCollectionIcon } from './collectionAppearance';
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
                <div {...stylex.props(styles.fieldGroup)}>
                    <span id="edit-collection-color-label" {...stylex.props(styles.fieldLabel)}>
                        Color
                    </span>
                    <div
                        role="radiogroup"
                        aria-labelledby="edit-collection-color-label"
                        {...stylex.props(styles.swatchRow)}
                    >
                        {COLLECTION_COLOR_PRESETS.map((preset) => (
                            <button
                                key={preset.hex}
                                type="button"
                                role="radio"
                                aria-checked={color === preset.hex}
                                aria-label={`${preset.name} color`}
                                {...stylex.props(styles.swatch, color === preset.hex && styles.swatchSelected)}
                                style={{ backgroundColor: preset.hex }}
                                onClick={() => setColor(color === preset.hex ? undefined : preset.hex)}
                            />
                        ))}
                    </div>
                </div>

                <div {...stylex.props(styles.fieldGroup)}>
                    <span id="edit-collection-icon-label" {...stylex.props(styles.fieldLabel)}>
                        Icon
                    </span>
                    <div
                        role="radiogroup"
                        aria-labelledby="edit-collection-icon-label"
                        {...stylex.props(styles.iconRow)}
                    >
                        {COLLECTION_ICON_NAMES.map((name) => {
                            const IconComponent: ComponentType<{ size?: number | string }> = getCollectionIcon(name);
                            const isSelected = icon === name;
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    role="radio"
                                    aria-checked={isSelected}
                                    aria-label={`${name} icon`}
                                    {...stylex.props(styles.iconButton, isSelected && styles.iconButtonSelected)}
                                    onClick={() => setIcon(isSelected ? undefined : name)}
                                >
                                    <IconComponent size={18} />
                                </button>
                            );
                        })}
                    </div>
                </div>

            </form>
        </Dialog>
    );
}

EditCollectionModal.displayName = 'EditCollectionModal';

export default EditCollectionModal;
