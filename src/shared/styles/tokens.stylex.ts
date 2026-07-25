import * as stylex from '@stylexjs/stylex';

/**
 * Minimal LunaClair design tokens.
 *
 * These tokens sit above Astryx theme tokens and are used by
 * LunaClair primitives for spacing, radius, shadow, and transitions
 * when Astryx defaults need supplementing.
 */
export const tokens = stylex.defineVars({
  radiusSm: '6px',
  radiusMd: '12px',
  spaceSm: '8px',
  spaceMd: '16px',
  spaceLg: '24px',
  shadowSm: '0 1px 3px rgba(0,0,0,0.08)',
  shadowMd: '0 8px 24px rgba(0,0,0,0.12)',
  transitionNormal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
});
