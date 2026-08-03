import type { ButtonVariant as AstryxButtonVariant } from '@astryxdesign/core/Button';

/**
 * LunaClair Button variant.
 * - primary: filled accent button (single most important action)
 * - secondary: outlined/default button
 * - ghost: borderless text+icon button — for dense lists/toolbars where
 *   bordered buttons add visual clutter
 * - danger: destructive action button
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Maps LunaClair ButtonVariant to Astryx ButtonVariant.
 * Shared by the Button and IconButton adapters.
 */
export function mapButtonVariant(variant?: ButtonVariant): AstryxButtonVariant {
  switch (variant) {
    case 'danger':
      return 'destructive';
    case 'secondary':
      return 'secondary';
    case 'ghost':
      return 'ghost';
    case 'primary':
    default:
      return 'primary';
  }
}
