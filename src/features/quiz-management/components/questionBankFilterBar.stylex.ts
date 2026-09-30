import * as stylex from '@stylexjs/stylex';

const desktopQuery = '@media (min-width: 769px)';

/**
 * StyleX rules for the Question Bank's filter/action bar — extracted from `QuestionBankTab.tsx`
 * with the bar itself, so the rules that only the bar uses live with it. The keys are unchanged
 * (and therefore the rendered class names are too); only their home moved.
 */
export const styles = stylex.create({
    /**
     * The bar as THREE rows at >=769px, in this order: (1) the search field and the selector
     * group, with the search growing to fill; (2) the tag facet at full width with its `+N more`
     * expander; (3) the entry-point actions, last and right-aligned. Each row keeps its own
     * container — a variable-length chip set with an expander cannot share a line with
     * fixed-width dropdowns, and the actions are entry points, not part of the search lens.
     * Below 769px row 2 is not rendered at all: the tag facet rides inside `mobileFilterPanel`,
     * so the content begins under row 1 and the actions row.
     */
    filterContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    /**
     * Row 1. `flexWrap: 'wrap'` is what keeps this row usable at narrow widths: the search field's
     * `minWidth: 180` plus the selector group (or the `Filter` trigger below 769px) exceed the bar,
     * so the selectors wrap under the search rather than overflowing.
     */
    searchRow: {
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
        width: '100%',
    },
    /**
     * The search field inside row 1: it grows to absorb the leftover width after the dropdowns, and
     * a `minWidth` keeps it usable before the row wraps.
     */
    searchField: {
        flex: 1,
        minWidth: 180,
    },
    /**
     * The three structured filters, as one subgroup. It carries NO right border: the divider was
     * ported from the Material Library's `membershipGroup`, where a right border separates a lens
     * that has controls to its RIGHT. Here the actions were the only thing that followed it, so
     * the rule dangled at the end of the row separating nothing; the row's own `gap` already spaces
     * these from the search field. On <769px it holds the `Filter` disclosure trigger instead of
     * the three selectors.
     */
    selectorGroup: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
    },
    /**
     * The two entry points — the bar's LAST row, right-aligned. As a flex item of the column
     * `filterContainer`, `marginLeft: 'auto'` is a CROSS-axis auto margin: it absorbs the free
     * horizontal space and pushes the row right, overriding the container's default
     * `align-items: stretch` (which would otherwise stretch the row to full width and leave the
     * buttons on the left). It is still what holds the right alignment now that this is a real row
     * rather than a wrapped fragment of the search row.
     */
    actionsGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginLeft: 'auto',
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
    /**
     * The <769px disclosure body: the three selectors and the tag facet, in that order. It is the
     * body the `Filter (N)` trigger opens, so it declares `none` at >=769px where the selectors
     * are inline and the tag facet is its own row.
     */
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
    /**
     * The tag facet's container. At >=769px it is row 2 — full width, which the column
     * `filterContainer`'s default `align-items: stretch` gives it, with no `width` of its own —
     * and the capped row + `+N more` / `Show fewer` expander belong to that surface. Below 769px
     * the SAME rule wraps the facet inside `mobileFilterPanel` instead, uncapped, where the panel's
     * own `gap` spaces it from the selectors: one wrapping row, so nothing here is width-specific.
     * In this two-tier design mirroring the Materials feature, the filter bar renders its own
     * `filterPill` / `filterPillActive` rules (ported from `LibraryView.tsx`), while the question
     * cards render the compact `tag` / `tagPressed` rules (mirroring `MaterialCard.tsx`'s `tagButton`).
     */
    tagGroup: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
    },
    /**
     * Filter pill in the Question Bank filter bar. Mirrors `localStyles.filterPill` from
     * `features/materials/components/LibraryView.tsx`: 12px font, 500 weight, 4px 12px padding,
     * radius 16, and solid `var(--color-background-surface)` resting background.
     */
    filterPill: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 12px',
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-background-surface)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
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
    /** Active/selected state for the filter pill. */
    filterPillActive: {
        backgroundColor: 'var(--color-accent-muted)',
        borderColor: 'var(--color-accent)',
        color: 'var(--color-text-accent)',
        ':hover': {
            borderColor: 'var(--color-accent)',
            color: 'var(--color-text-accent)',
            backgroundColor: 'var(--color-accent-muted)',
        },
    },
    /** Dimmed `#` sigil; de-emphasized relative to the tag label, matching Materials LibraryView. */
    filterHash: {
        color: 'var(--color-text-disabled)',
    },
    /** When the pill is active/pressed, the hash inherits the accent text ink. */
    filterHashActive: {
        color: 'inherit',
    },
    /** `+N more` / `Show fewer` expander — a text affordance, not a pill. >=769px only: the
     * <769px panel wraps every tag, so it needs no expander. */
    tagMore: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        textDecoration: 'underline',
        backgroundColor: 'transparent',
        borderWidth: 0,
        padding: 0,
        ':hover': {
            color: 'var(--color-text-primary)',
        },
        ':focus-visible': {
            outline: '2px solid var(--color-accent)',
            outlineOffset: '2px',
        },
    },
});
