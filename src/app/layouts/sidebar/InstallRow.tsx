import * as stylex from '@stylexjs/stylex';
import { Download } from 'lucide-react';
import { isIOS, isStandalone } from '../../overlays/installDetection';
const mobile = '@media (max-width: 768px)';

interface InstallRowProps {
  onClick: () => void;
}

/**
 * Quiet opt-in PWA install row (desktop/tablet). Hidden on mobile — the
 * iOS one-time card serves mobile iOS and Android uses its native menu —
 * and hidden when the app already runs installed (standalone). Copy
 * branches by platform: iOS users need the A2HS instructions; everyone
 * else uses the browser's native install affordance.
 */
export function InstallRow({ onClick }: InstallRowProps) {
  const label = isIOS() ? 'Add to Home Screen' : 'Install app';
  if (isStandalone()) return null;

  return (
    <>
      {/* The divider must hide on mobile too — otherwise a lone vertical
          separator shows in the bottom dock above the hidden button. */}
      <div {...stylex.props(styles.divider)} aria-hidden="true" />
      <button
        type="button"
        {...stylex.props(styles.navItem)}
        onClick={onClick}
        title={label}
      >
        <Download size={18} />
        <span {...stylex.props(styles.navLabel)}>{label}</span>
      </button>
    </>
  );
}

const styles = stylex.create({
  divider: {
    height: 1,
    backgroundColor: 'var(--color-border)',
    marginTop: 8,
    marginBottom: 8,
    opacity: 0.6,
    [mobile]: {
      display: 'none',
    },
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 12,
    width: '100%',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 500,
    textAlign: 'left',
    transition: 'all 0.15s ease',
    boxSizing: 'border-box',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
      color: 'var(--color-text-primary)',
    },
    [mobile]: {
      display: 'none',
    },
  },
  navLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    '@media (min-width: 769px) and (max-width: 1023px)': {
      display: 'none',
    },
    [mobile]: {
      display: 'none',
    },
  },
});
