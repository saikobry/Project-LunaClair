import { defineTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral';

/**
 * Custom role tokens beyond the Astryx `TokenName` union (a closed type we
 * can't augment). They're the on-muted readable-text / border roles of the
 * sentiment pairs. See `quizBadgeAppearance.ts` for the sourcing rule.
 */
type CustomRoleTokens =
  | '--color-on-success-muted'
  | '--color-on-warning-muted'
  | '--color-success-border'
  | '--color-warning-border'
  | '--color-error-border'
  // Code surfaces (dark reading/writing chrome + light inline chip)
  | '--color-background-code'
  | '--color-text-code'
  | '--color-text-code-link'
  | '--color-background-code-inline'
  // AI chat transcript code blocks — deliberately NOT the code family
  | '--color-background-chat-assistant'
  | '--color-text-chat-assistant'
  // Question-type badge hues (visual categories, reused across quiz surfaces)
  | '--color-badge-blue-bg'
  | '--color-badge-blue-fg'
  | '--color-badge-violet-bg'
  | '--color-badge-violet-fg'
  | '--color-badge-teal-bg'
  | '--color-badge-teal-fg'
  | '--color-badge-amber-bg'
  | '--color-badge-amber-fg'
  | '--color-badge-pink-bg'
  | '--color-badge-pink-fg';

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
 *   error:    #dc2626
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
    // Custom role tokens outside the Astryx `TokenName` union (a closed type)
    // — spread as a typed object so the rest of `tokens` keeps excess-key
    // checking (casting the whole literal would disable it). See
    // `quizBadgeAppearance.ts` for the sourcing rule.
    ...({
      // Role token: readable text on `--color-success-muted` (correct-answer
      // previews, explanation boxes). Resolves the previously hardcoded #166534.
      '--color-on-success-muted': '#166534',
      // Role token: readable text on `--color-warning-muted` (draft badges,
      // medium difficulty). Chosen over #854d0e for higher contrast on #fef3c7
      // (6.37:1 vs 6.15:1) and canonical amber-800.
      '--color-on-warning-muted': '#92400e',
      // Border roles of the muted sentiment surfaces (outlines). The success
      // pair is the model — a 100-shade fill with a 200-shade outline
      // (#dcfce7 / #bbf7d0, Astryx's own pair). Error's fill is a 50-shade
      // (#fef2f2), so its 100-shade would be invisible at 1px; red-200 is the
      // first visible step. These exist so an outline never borrows the
      // `-muted` fill role.
      '--color-success-border': '#bbf7d0',
      '--color-warning-border': '#fde68a',
      '--color-error-border': '#fecaca',
      // Dark code surfaces: one canonical One Dark pair shared by the reader's
      // fenced blocks and the writer's raw-markdown editor (their drifted
      // #0f172a/#e2e8f0 and #282c34/#abb2bf converged here).
      '--color-background-code': '#282c34',
      '--color-text-code': '#abb2bf',
      // Link color inside the reading surface (was the bare #0366d6).
      '--color-text-code-link': '#0366d6',
      // Light inline-code chip in the reader (was the bare #f0f0f0).
      '--color-background-code-inline': '#f0f0f0',
      // AI transcript code blocks — a chat-context surface, deliberately kept
      // out of the code family (a chat bubble and a code editor are different
      // semantic contexts and must not move together).
      '--color-background-chat-assistant': '#1e293b',
      '--color-text-chat-assistant': '#f8fafc',
      // Question-type badge palette — hue-named (visual categories, not type
      // names), so a future feature can reuse a hue. Sourced from the old
      // literal QUESTION_TYPE_APPEARANCE pairs; see quizBadgeAppearance.ts.
      '--color-badge-blue-bg': '#dbeafe',
      '--color-badge-blue-fg': '#1d4ed8',
      '--color-badge-violet-bg': '#ede9fe',
      '--color-badge-violet-fg': '#6d28d9',
      '--color-badge-teal-bg': '#ccfbf1',
      '--color-badge-teal-fg': '#0f766e',
      '--color-badge-amber-bg': '#fef3c7',
      '--color-badge-amber-fg': '#b45309',
      '--color-badge-pink-bg': '#fce7f3',
      '--color-badge-pink-fg': '#be185d',
    } as Record<CustomRoleTokens, string>),

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
