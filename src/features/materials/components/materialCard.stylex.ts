import * as stylex from '@stylexjs/stylex';

export const cardStyles = stylex.create({
  /**
   * Card-surface hover affordance. The border belongs to the `Card` element
   * (its default variant draws `--color-border-emphasized`), so the emphasis is
   * applied there through `Card`'s `xstyle` — the inner shell has no border of
   * its own and would render a doubled box if it were given one.
   *
   * Matches the app's interactive-surface idiom (Home `recentCard`,
   * `CollectionMaterialRow`): resting border untouched, accent on hover, same
   * 0.18s timing as the lift below so the two read as one gesture.
   */
  cardHoverBorder: {
    transition: 'border-color 0.18s ease',
    ':hover': {
      borderColor: 'var(--color-accent)',
    },
  },
  interactive: {
    cursor: 'pointer',
    position: 'relative',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
    ':hover': {
      transform: 'translateY(-2px)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  clickableArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 20,
    height: '100%',
    userSelect: 'none',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 30,
  },
  titleColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  title: {
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
   * The card's single keyboard/AT affordance: opening the material. The card
   * container itself is presentational so the badge and action controls inside
   * it keep independent semantics and focus order.
   */
  titleButton: {
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
  description: {
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
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  tagsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
    overflow: 'hidden',
    minHeight: 26,
  },
  /** Tag cloud inside the overflow viewer — wraps, unlike the single-line row. */
  popoverTags: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  /** Off-screen width probe — same pills, never painted. */
  measurer: {    position: 'absolute',
    top: 0,
    left: 0,
    visibility: 'hidden',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
    whiteSpace: 'nowrap',
  },
  tagChip: {
    textTransform: 'none',
    fontWeight: 600,
  },
  /** Card tag toggle — pill-rounded like the library filter pills. */
  tagButton: {
    display: 'inline-flex',
    alignItems: 'center',
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
  tagButtonActive: {
    backgroundColor: 'var(--color-accent-muted)',
    borderColor: 'var(--color-accent)',
    color: 'var(--color-text-accent)',
  },
  /** Bordered-top footer: recency left, Quiz action right. */
  footer: {
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
  /** Promoted Quiz action (Manage lives in the ⋯ menu). */
  quizButton: {
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
      color: '#ffffff',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  /** Muted `+N` overflow pill (badges beyond the cap). */
  badgeOverflow: {
    backgroundColor: 'var(--color-background-muted)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-secondary)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s, border-color 0.15s, color 0.15s',
    ':hover': {
      borderColor: 'var(--color-accent)',
      color: 'var(--color-accent)',
      backgroundColor: 'var(--color-accent-muted)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--color-text-disabled)',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  /**
   * Rendered through a portal (`document.body`, fixed position from the
   * trigger rect) so it escapes grid rows and virtualized-row transforms —
   * an inline absolute popover slides under the next row's cards. Position
   * comes from inline style; this holds the surface treatment only.
   */
  popover: {
    backgroundColor: 'var(--color-background-surface)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    minWidth: 280,
    maxWidth: 360,
    maxHeight: 400,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  popoverHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--color-border)',
  },
  popoverHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  popoverTitle: {
    fontWeight: 600,
    fontSize: 14,
    color: 'var(--color-text-primary)',
  },
  popoverSubtitle: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    margin: 0,
    marginTop: 4,
  },
  popoverList: {
    maxHeight: 300,
    overflowY: 'auto',
    padding: 8,
  },
  popoverEmpty: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    padding: 16,
    textAlign: 'center',
  },
  /** Rendered as a real <button> so each collection toggle is independently focusable. */
  popoverRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '-2px',
    },
  },
  /** In-flight row: dimmed and non-interactive so a toggle cannot double-fire. */
  popoverRowPending: {
    opacity: 0.55,
    cursor: 'default',
    ':hover': {
      backgroundColor: 'transparent',
    },
  },
  popoverIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  popoverRowLabel: {
    fontSize: 13,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  popoverCheck: {
    color: 'var(--color-success)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  popoverPlus: {
    color: 'var(--color-text-secondary)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  membershipSection: {
    display: 'flex',
    alignItems: 'center',
  },
  /** Badges + file trigger on one row — filing lives with the playlists. */
  membershipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
    minHeight: 30,
  },
  membershipBadges: {
    flex: 1,
    minWidth: 0,
  },
  membershipEmpty: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: 'var(--color-text-disabled)',
  },
  badgeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 6px',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    fontSize: 11,
    textDecoration: 'none',
    margin: 0,
  },
  badgeButtonClickable: {
    cursor: 'pointer',
    transition: 'border-color 0.15s, filter 0.15s',
    ':hover': {
      borderColor: 'var(--color-accent)',
      filter: 'brightness(1.2)',
    },
  },
  badgeButtonStatic: {
    cursor: 'default',
  },
  badgeLabel: {
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});
