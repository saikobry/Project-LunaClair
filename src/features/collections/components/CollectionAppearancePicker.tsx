import * as stylex from '@stylexjs/stylex';
import type { ComponentType } from 'react';
import {
    COLLECTION_COLOR_PRESETS,
    COLLECTION_ICON_NAMES,
    getCollectionIcon,
} from '../modals/collectionAppearance';
import { collectionModalStyles as styles } from '../modals/collectionModal.stylex';

/**
 * Shared color + icon picker for the collection dialogs.
 *
 * Unifies the verbatim copy-pasted swatch/icon `radiogroup` blocks from
 * `CreateCollectionModal` and `EditCollectionModal`. Consumes the shared
 * `collectionAppearance` registry and `collectionModal.stylex.ts` so both
 * dialogs stay visually identical. Toggle-off semantics preserved:
 * clicking a selected swatch/icon deselects it (`undefined`).
 */

export interface CollectionAppearancePickerProps {
    color: string | undefined;
    icon: string | undefined;
    onColorChange: (color: string | undefined) => void;
    onIconChange: (icon: string | undefined) => void;
    /**
     * Label ids wiring each `radiogroup` to its visible label.
     * Defaults match the create dialog (`collection-*-label`); the edit
     * dialog passes its `edit-collection-*-label` pair.
     */
    labelIds?: { color: string; icon: string };
}

const DEFAULT_LABEL_IDS = { color: 'collection-color-label', icon: 'collection-icon-label' };

export function CollectionAppearancePicker({
    color,
    icon,
    onColorChange,
    onIconChange,
    labelIds = DEFAULT_LABEL_IDS,
}: CollectionAppearancePickerProps) {
    const colorLabelId = labelIds.color;
    const iconLabelId = labelIds.icon;
    return (
        <>
            <div {...stylex.props(styles.fieldGroup)}>
                <span id={colorLabelId} {...stylex.props(styles.fieldLabel)}>
                    Color
                </span>
                <div
                    role="radiogroup"
                    aria-labelledby={colorLabelId}
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
                            onClick={() => onColorChange(color === preset.hex ? undefined : preset.hex)}
                        />
                    ))}
                </div>
            </div>

            <div {...stylex.props(styles.fieldGroup)}>
                <span id={iconLabelId} {...stylex.props(styles.fieldLabel)}>
                    Icon
                </span>
                <div
                    role="radiogroup"
                    aria-labelledby={iconLabelId}
                    {...stylex.props(styles.iconRow)}
                >
                    {COLLECTION_ICON_NAMES.map((name) => {
                        const IconComponent: ComponentType<{ size?: number | string }> =
                            getCollectionIcon(name);
                        const isSelected = icon === name;
                        return (
                            <button
                                key={name}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={`${name} icon`}
                                {...stylex.props(styles.iconButton, isSelected && styles.iconButtonSelected)}
                                onClick={() => onIconChange(isSelected ? undefined : name)}
                            >
                                <IconComponent size={18} />
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

CollectionAppearancePicker.displayName = 'CollectionAppearancePicker';

export default CollectionAppearancePicker;
