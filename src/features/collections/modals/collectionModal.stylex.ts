import * as stylex from '@stylexjs/stylex';

/**
 * Shared StyleX styles for the collection dialogs (`CreateCollectionModal`,
 * `EditCollectionModal`).
 *
 * Keeps both modals visually identical: same form rhythm, same token-based
 * swatch/icon selection rings, and one footer pattern (destructive action on
 * the left, Cancel + primary submit docked right) rendered through the shared
 * `Dialog footer=` slot.
 */
export const collectionModalStyles = stylex.create({
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
        gap: 8,
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
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor: 'transparent',
        cursor: 'pointer',
        padding: 0,
        transition: 'transform 0.12s ease, border-color 0.12s ease',
        ':hover': {
            transform: 'scale(1.1)',
        },
        ':focus-visible': {
            outline: '2px solid var(--color-accent)',
            outlineOffset: 2,
        },
    },
    swatchSelected: {
        borderColor: 'var(--color-accent)',
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
    modalFooter: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        width: '100%',
    },
    modalActions: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
        marginLeft: 'auto',
        flex: 1,
    },
});
