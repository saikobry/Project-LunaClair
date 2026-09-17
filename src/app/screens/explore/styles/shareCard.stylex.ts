import * as stylex from '@stylexjs/stylex';

/**
 * StyleX rules for one published-share card.
 *
 * The meter is deliberately shared with `MaterialCard` (padding 20 / gap 12,
 * single-line title, 2-line reserved description, quiet meta voice, badges
 * pinned above a bordered-top footer with `minHeight: 45`, accent-pill action)
 * so Explore cards and library cards read as one family and grid rows align.
 *
 * ShareCard's own addition is the **byline row** under the title: author left,
 * download/view stats right — one quiet meta line instead of a stats block of
 * its own, which frees the bottom rows for badges and the footer action.
 */
export const styles = stylex.create({
  card: {
    display: 'flex',
    flexDirection: 'column',
    padding: 20,
    height: '100%',
    boxSizing: 'border-box',
    gap: 12,
    userSelect: 'none',
  },
  /**
   * Card-surface hover affordance. The border belongs to the `Card` element, so
   * the emphasis is applied there through `Card`'s `xstyle` — the inner shell
   * has no border of its own and would render a doubled box. Same idiom and
   * timing as `MaterialCard`: the border accent carries the hover; the shell
   * only lifts and adds no shadow of its own.
   */
  cardHoverBorder: {
    transition: 'border-color 0.18s ease',
    ':hover': {
      borderColor: 'var(--color-accent)',
    },
  },
  clickableCard: {
    cursor: 'pointer',
    transition: 'transform 0.18s ease',
    ':hover': {
      transform: 'translateY(-2px)',
    },
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  /**
   * The card's open control. The title is the one keyboard/AT path to the
   * share, so the title itself is a real `<button>` reset to look like the
   * heading text it lives in — and it, not the shell, wears the focus ring.
   */
  cardTitleButton: {
    display: 'block',
    width: '100%',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    color: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
      borderRadius: 4,
    },
  },
  cardDescription: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.7,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    minHeight: 41,
  },
  /** Empty-description placeholder voice: quiet, italic, single line. */
  descriptionEmpty: {
    color: 'var(--color-text-disabled)',
    fontStyle: 'italic',
    WebkitLineClamp: 1,
  },
  /**
   * Byline row — author left, stats right, one quiet `--color-text-disabled`
   * line directly under the title. Split like the footer (left/right) so the
   * card reads as header → byline → description → badges → action.
   */
  bylineRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 20,
  },
  bylineAuthor: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--color-text-disabled)',
    minWidth: 0,
    overflow: 'hidden',
  },
  bylineStats: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 12,
    color: 'var(--color-text-disabled)',
    flexShrink: 0,
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  /**
   * Bottom pinned badge row (Community/Verified) — the slot and geometry of
   * `MaterialCard`'s membership row, so rows align across the grid regardless
   * of title/description length. The author lives in the byline row now; this
   * row is badge-only.
   */
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
    overflow: 'hidden',
    marginTop: 'auto',
    minHeight: 30,
  },
  /**
   * Badge pills — `MaterialCard`'s `badgeButton` geometry verbatim. Color is
   * supplied per instance through inline style (MaterialCard's pattern for
   * collection badges; here the triples are static, see `badgeColors` in the
   * component). Borders must stay longhand: StyleX silently drops border
   * shorthands that contain `var()`/`color-mix()`.
   */
  badgeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 6px',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    fontSize: 11,
    fontWeight: 600,
    margin: 0,
    whiteSpace: 'nowrap',
  },
  badgeLabel: {
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  /**
   * Footer: bordered-top action strip matching `MaterialCard`'s footer
   * geometry. The "In My Library" chip lives in the badge row now, so the
   * action pill is the only child — `footerActions`' `marginLeft: 'auto'`
   * keeps it right-aligned, exactly where `MaterialCard`'s Quiz pill sits.
   * The divider is written as the longhand triplet on purpose: StyleX drops
   * the `borderTop` shorthand when its value carries `var()`, which is why
   * the divider silently never rendered.
   */
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: 'var(--color-border)',
    paddingTop: 12,
    marginTop: 4,
    minHeight: 45,
  },
  footerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  /**
   * Footer action in `MaterialCard`'s accent-pill voice (its Quiz button):
   * quiet accent-muted at rest, fills accent on hover. Replaces the full
   * primary `Button`, whose visual weight broke the shared card family.
   */
  actionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 12px',
    borderRadius: 8,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'var(--color-accent-muted)',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-accent)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background-color 0.15s, color 0.15s',
    ':hover': {
      backgroundColor: 'var(--color-accent)',
      color: 'var(--color-on-accent)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  /** In-flight clone: dimmed and non-interactive (`popoverRowPending` idiom). */
  actionPillBusy: {
    opacity: 0.55,
    cursor: 'default',
    ':hover': {
      backgroundColor: 'var(--color-accent-muted)',
      color: 'var(--color-text-accent)',
    },
  },
});
