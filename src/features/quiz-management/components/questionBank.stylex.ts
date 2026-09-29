import * as stylex from '@stylexjs/stylex';

/**
 * StyleX rules for the Question Bank list and its card — extracted from `QuestionBankTab.tsx` so
 * the tab's component is readable without a ~194-line style block in front of it. The bar's own
 * rules live with the bar (`questionBankFilterBar.stylex.ts`). The keys are unchanged (and
 * therefore the rendered class names are too); only their home moved.
 */
export const styles = stylex.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
    },
    cardContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    promptRow: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    prompt: {
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        margin: 0,
        lineHeight: 1.5,
        flex: 1,
        minWidth: 0,
    },
    topRightStatusBadge: {
        flexShrink: 0,
    },
    badgesRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
    },
    detailSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        paddingTop: 8,
        borderTop: '1px solid var(--color-border)',
    },
    detailLabel: {
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'capitalize',
        letterSpacing: 0.4,
        color: 'var(--color-text-disabled)',
    },
    explanationPreview: {
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        lineHeight: 1.5,
        margin: 0,
        maxWidth: '80%',
    },
    tagsRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
    },
    cardFooter: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        paddingTop: 10,
        marginTop: 6,
        borderTop: '1px solid var(--color-border)',
    },
    cardFooterMeta: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    versionTag: {
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-text-disabled)',
    },
    cardActions: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        marginLeft: 'auto',
    },
    // Badge variant styles for status and usage
    badgedot: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'capitalize',
        border: 'none',
        borderRadius: 5,
    },
    badgePublished: {
        backgroundColor: 'var(--color-success-muted)',
        color: 'var(--color-on-success-muted)',
    },
    badgeDraft: {
        backgroundColor: 'var(--color-warning-muted)',
        color: 'var(--color-on-warning-muted)',
    },
    badgeArchived: {
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-disabled)',
    },
    badgeUsed: {
        backgroundColor: 'var(--color-accent-muted)',
        color: 'var(--color-accent)',
    },
    badgeUnused: {
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-secondary)',
    },
    tag: {
        fontSize: 10.5,
        padding: '1px 7px',
        border: 'none',
        borderRadius: 4,
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        transition: 'background-color 0.15s ease, color 0.15s ease',
        ':hover': {
            backgroundColor: 'var(--color-accent-muted)',
            color: 'var(--color-accent)',
        },
        ':active': {
            opacity: 0.8,
        },
    },
});
