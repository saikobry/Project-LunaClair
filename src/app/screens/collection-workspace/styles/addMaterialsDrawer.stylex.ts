import * as stylex from '@stylexjs/stylex';

const fadeIn = stylex.keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const slideInRight = stylex.keyframes({
  from: { transform: 'translateX(100%)' },
  to: { transform: 'translateX(0)' },
});

/** StyleX rules for `AddMaterialsDrawer` and its material rows. */
export const styles = stylex.create({
  /**
   * Right-edge slide-over rendered as a native modal `<dialog>`, opened with
   * `showModal()` so focus trapping, Escape-to-close, focus restoration, the
   * `::backdrop`, and top-layer stacking come from the platform instead of a
   * hand-rolled `role="dialog"` wrapper.
   *
   * Beyond the original box, only the UA dialog defaults that would change that
   * box are overridden — the panel must stay geometrically identical to the
   * previous portal + backdrop-overlay markup:
   * - `height: auto` overrides the UA `dialog { height: fit-content }`. With
   *   `top` and `bottom` both set, `auto` stretches the panel to the full
   *   viewport height; `fit-content` would collapse it to its content and make
   *   the over-constrained `bottom: 0` a no-op.
   * - `overflow: visible` overrides the UA `dialog:modal { overflow: auto }`,
   *   which would scroll the whole panel instead of the inner materials list.
   * - `margin: 0`, `padding: 0`, zero width borders and `max-height: none`
   *   override the UA `margin: auto`, `padding: 1em`, `border: solid` and
   *   `max-height: calc(100% - 6px - 2em)`.
   */
  drawer: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 'auto',
    height: 'auto',
    margin: 0,
    width: 480,
    maxWidth: '100vw',
    maxHeight: 'none',
    padding: 0,
    borderWidth: 0,
    borderStyle: 'none',
    borderLeftWidth: 1,
    borderLeftStyle: 'solid',
    borderLeftColor: 'var(--color-border)',
    overflow: 'visible',
    backgroundColor: 'var(--color-background-surface)',
    color: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
    animationName: slideInRight,
    animationDuration: '0.25s',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    '::backdrop': {
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      animationName: fadeIn,
      animationDuration: '0.2s',
      animationTimingFunction: 'ease-out',
    },
  },
  header: {
    padding: 20,
    borderBottom: '1px solid var(--color-border)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: '4px 0 0 0',
  },
  searchContainer: {
    padding: 16,
    borderBottom: '1px solid var(--color-border)',
  },
  materialsList: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
  },
  listEmpty: {
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
    fontSize: 14,
  },
  materialItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    transition: 'background-color 0.16s',
  },
  materialItemHover: {
    backgroundColor: 'var(--color-overlay-hover)',
  },
  iconMark: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'var(--color-overlay-hover)',
    color: 'var(--color-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  materialContent: {
    flex: 1,
    minWidth: 0,
  },
  materialTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  /** Tag pills use the shared neutral `Chip`; the row only wraps them. */
  materialTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  footer: {
    padding: 16,
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
  },
});
