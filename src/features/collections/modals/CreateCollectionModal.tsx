import { useState, type ComponentType, type FormEvent } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { Input } from '../../../shared/ui/Input/Input';
import { TextArea } from '../../../shared/ui/TextArea/TextArea';
import { Button } from '../../../shared/ui/Button/Button';
import { COLLECTION_COLOR_PRESETS, COLLECTION_ICON_NAMES, getCollectionIcon } from './collectionAppearance';

export interface CreateCollectionModalProps {
    isOpen: boolean;
    onSave: (input: { title: string; description?: string; icon?: string; color?: string }) => void;
    onClose: () => void;
}

const styles = stylex.create({
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
    },
    fieldGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    swatchRow: {
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
    },
    swatch: {
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: '2px solid transparent',
        cursor: 'pointer',
        padding: 0,
        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
        ':hover': {
            transform: 'scale(1.1)',
        },
        ':focus-visible': {
            outline: '2px solid var(--color-accent)',
            outlineOffset: 2,
        },
    },
    swatchSelected: {
        boxShadow: '0 0 0 2px var(--color-background-surface), 0 0 0 4px var(--color-accent)',
    },
    iconRow: {
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
    },
    iconButton: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-background-surface)',
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        transition: 'border-color 0.12s ease, color 0.12s ease',
        ':hover': {
            borderColor: 'var(--color-accent)',
        },
        ':focus-visible': {
            outline: '2px solid var(--color-accent)',
            outlineOffset: 2,
        },
    },
    iconButtonSelected: {
        borderColor: 'var(--color-accent)',
        color: 'var(--color-accent)',
        backgroundColor: 'var(--color-overlay-hover)',
    },
    modalActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
    },
});

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
        const trimmed = title.trim();
        if (!trimmed) return;
        onSave({
            title: trimmed,
            description: description.trim() || undefined,
            icon,
            color,
        });
    };

    return (
        <Dialog isOpen={isOpen} onClose={onClose} title="New Collection" width={460} purpose="form">
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

                <div {...stylex.props(styles.fieldGroup)}>
                    <span id="collection-color-label" {...stylex.props(styles.fieldLabel)}>
                        Color
                    </span>
                    <div
                        role="radiogroup"
                        aria-labelledby="collection-color-label"
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
                    <span id="collection-icon-label" {...stylex.props(styles.fieldLabel)}>
                        Icon
                    </span>
                    <div
                        role="radiogroup"
                        aria-labelledby="collection-icon-label"
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

                <div {...stylex.props(styles.modalActions)}>
                    <Button label="Cancel" variant="secondary" onClick={onClose} />
                    <Button
                        label="Create Collection"
                        variant="primary"
                        type="submit"
                        isDisabled={!title.trim()}
                    />
                </div>
            </form>
        </Dialog>
    );
}

CreateCollectionModal.displayName = 'CreateCollectionModal';

export default CreateCollectionModal;
