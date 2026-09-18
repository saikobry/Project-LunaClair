import * as stylex from '@stylexjs/stylex';

/**
 * StyleX rules for the database reload screen.
 *
 * The viewport fills the shell that is deliberately not mounted, so the state is never a blank page.
 * `100svh` (not `100vh`) keeps it honest under mobile browser chrome; the body already paints the app
 * background, so this wrapper stays transparent.
 */
export const databaseReloadScreenStyles = stylex.create({
  viewport: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100svh',
    boxSizing: 'border-box',
    padding: 24,
  },
});
