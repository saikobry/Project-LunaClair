import * as stylex from '@stylexjs/stylex';

const desktopQuery = '@media (min-width: 769px)';

/**
 * StyleX rules for the Question Bank's filter/action bar — extracted from `QuestionBankTab.tsx`
 * with the bar itself, so the rules that only the bar uses live with it. The keys are unchanged
 * (and therefore the rendered class names are too); only their home moved.
 */
export const styles = stylex.create({
    filterBar: {
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    searchField: {
        flex: 1,
        minWidth: 180,
    },
    desktopSelectors: {
        display: 'none',
        [desktopQuery]: {
            display: 'flex',
            alignItems: 'center',
            gap: 10,
        },
    },
    mobileFilterTrigger: {
        display: 'flex',
        [desktopQuery]: {
            display: 'none',
        },
    },
    mobileFilterPanel: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        padding: 12,
        backgroundColor: 'var(--color-background-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        boxSizing: 'border-box',
        [desktopQuery]: {
            display: 'none',
        },
    },
    newQuestionButton: {
        marginLeft: 'auto',
    },
});
