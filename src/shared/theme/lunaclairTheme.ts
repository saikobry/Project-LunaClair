import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral';

/**
 * LunaClair custom Astryx theme.
 *
 * Preserves the existing LunaClair app appearance by overriding the
 * neutral theme's tokens with the project's original color palette
 * from `library.stylex.ts` and `global.css`.
 *
 * Extends neutralTheme so spacing, sizing, motion, and typography
 * defaults carry through for any non-overridden token.
 *
 * Key colors:
 *   accent:   #6366f1  (indigo)
 *   primary:  #08060d  (near-black)
 *   secondary:#6b6375  (muted gray)
 *   border:   #e5e4e7
 *   danger:   #dc2626
 *   bg:       #ffffff
 *   muted:    #f9fafb
 */
export const lunaclairTheme = defineTheme({
  name: 'lunaclair',
  extends: neutralTheme,

  // System UI font stack matching the original app
  typography: {
    scale: { base: 14, ratio: 1.2 },
    body: {
      family:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fallbacks: '',
    },
    heading: {
      family:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fallbacks: '',
      weights: { 3: 'bold', 4: 'bold' },
    },
    code: {
      family: 'ui-monospace, Consolas, monospace',
      fallbacks: '',
    },
  },

  tokens: {
    // =========================================================================
    // Accent — indigo (#6366f1)
    // =========================================================================
    '--color-accent': '#6366f1',
    '--color-accent-muted': '#eef2ff',
    '--color-on-accent': '#ffffff',
    '--color-neutral': 'rgba(0,0,0,0.06)',

    // =========================================================================
    // Backgrounds — white canvas
    // =========================================================================
    '--color-background-surface': '#ffffff',
    '--color-background-body': '#ffffff',
    '--color-background-card': '#ffffff',
    '--color-background-popover': '#ffffff',
    '--color-background-muted': '#f9fafb',
    '--color-background-inverted': '#08060d',
    '--color-background-error-inverted': '#dc2626',

    // =========================================================================
    // Overlays
    // =========================================================================
    '--color-overlay': 'rgba(0,0,0,0.3)',
    '--color-overlay-hover': 'rgba(99,102,241,0.08)',
    '--color-overlay-pressed': 'rgba(99,102,241,0.15)',

    // =========================================================================
    // Text
    // =========================================================================
    '--color-text-primary': '#08060d',
    '--color-text-secondary': '#6b6375',
    '--color-text-disabled': '#9ca3af',
    '--color-text-accent': '#6366f1',
    '--color-on-dark': '#ffffff',
    '--color-on-light': '#08060d',

    // =========================================================================
    // Icon
    // =========================================================================
    '--color-icon-accent': '#6366f1',
    '--color-icon-primary': '#08060d',
    '--color-icon-secondary': '#6b6375',
    '--color-icon-disabled': '#9ca3af',

    // =========================================================================
    // Status / Sentiment
    // =========================================================================
    '--color-success': '#16a34a',
    '--color-success-muted': '#dcfce7',
    '--color-on-success': '#ffffff',
    '--color-error': '#dc2626',
    '--color-error-muted': '#fef2f2',
    '--color-on-error': '#ffffff',
    '--color-warning': '#f59e0b',
    '--color-warning-muted': '#fef3c7',
    '--color-on-warning': '#08060d',

    // =========================================================================
    // Border
    // =========================================================================
    '--color-border': '#e5e4e7',
    '--color-border-emphasized': '#d1d5db',

    // =========================================================================
    // Effects
    // =========================================================================
    '--color-skeleton': '#e5e4e7',
    '--color-shadow': 'rgba(0,0,0,0.06)',
    '--color-tint-hover': 'black',

    // =========================================================================
    // Shadows — matching the original card shadow
    // =========================================================================
    '--shadow-low':
      '0 1px 3px rgba(0,0,0,0.06)',
    '--shadow-med':
      '0 4px 16px rgba(99,102,241,0.12)',
    '--shadow-high':
      '0 20px 60px rgba(0,0,0,0.15)',

    // =========================================================================
    // Radius — matching original card/modal border radius
    // =========================================================================
    '--radius-none': '0px',
    '--radius-inner': '4px',
    '--radius-element': '8px',
    '--radius-container': '12px',
    '--radius-page': '16px',
    '--radius-full': '9999px',
  },

  components: {
    // =========================================================================
    // Button — indigo primary, outlined secondary, red destructive
    // =========================================================================
    button: {
      base: {
        borderRadius: '10px',
      },
      'variant:primary': {
        boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
      },
      'variant:destructive': {
        backgroundColor: '#dc2626',
        color: '#ffffff',
      },
    },

    // =========================================================================
    // Dialog — matches old modal overlay style
    // =========================================================================
    dialog: {
      base: {
        padding: 'var(--spacing-7)',
      },
    },
  },
});
