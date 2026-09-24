import * as stylex from '@stylexjs/stylex';

/**
 * Shared StyleX rules for the choice-list editors — extracted from
 * MultipleChoiceEditor / MultipleSelectEditor, which carried an identical
 * block. `ChoiceListRow` uses the row rules; the two thin wrappers keep the
 * container and hint (they own hint copy and the Add button).
 */
export const styles = stylex.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    choiceRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 6px',
        borderRadius: 8,
        border: '1px solid transparent',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
    },
    choiceRowActive: {
        backgroundColor: 'var(--color-success-muted)',
        borderColor: 'transparent',
    },
    choiceInput: {
        flex: 1,
    },
    hint: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        margin: 0,
    },
});
