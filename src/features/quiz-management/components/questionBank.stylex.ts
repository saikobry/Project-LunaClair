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
    /**
     * Tag row. The material card fits its tags on one measured line and collapses the rest into a
     * `+N` viewer; the Bank is a wrapping list, so its row wraps instead — the chips carry the
     * same treatment, the overflow strategy stays the Bank's own.
     */
    tagsRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
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
    /**
     * Card tag toggle. A Question Bank question card tag is a filter toggle (`aria-pressed`), so it
     * carries the treatment of the material card's tag toggle — `tagButton` / `tagButtonActive` in
     * `features/materials/components/materialCard.stylex.ts` (compact 11px font, 3px 10px padding,
     * radius 999, transparent background). The filter bar uses its own `filterPill` rule set from
     * `questionBankFilterBar.stylex.ts` (mirroring `LibraryView.tsx`'s `filterPill`).
     *
     * The rules are duplicated rather than imported: a StyleX rule set is not a feature contract,
     * and a `materials` import in this feature would be a new cross-feature edge. They must move
     * together — this set is the look, that feature owns it. `maxWidth` + `overflowWrap` are the one
     * deliberate addition: the card's row is single-line, the Bank's wraps, so a pathologically long
     * tag wraps inside its own chip instead of widening the card. Never a literal colour.
     */
    tag: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 999,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'var(--color-border)',
        backgroundColor: 'transparent',
        fontFamily: 'inherit',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        maxWidth: '100%',
        overflowWrap: 'anywhere',
        transition: 'background-color 0.15s, border-color 0.15s, color 0.15s',
        ':hover': {
            borderColor: 'var(--color-accent)',
            color: 'var(--color-text-primary)',
        },
        ':focus-visible': {
            outline: '2px solid var(--color-accent)',
            outlineOffset: '2px',
        },
    },
    /** Pressed tag toggle — the active-filter state (`aria-pressed`). */
    tagPressed: {
        backgroundColor: 'var(--color-accent-muted)',
        borderColor: 'var(--color-accent)',
        color: 'var(--color-text-accent)',
    },
});
