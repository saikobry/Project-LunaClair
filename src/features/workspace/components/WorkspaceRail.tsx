import { useState, useCallback, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Home, BookText, GraduationCap, Menu, X } from 'lucide-react';
import type { AppRoute } from '../../../app/layouts/AppShell';
import { useSubject } from '../../../shared/hooks/useSubject';
import { useMaterial } from '../../../shared/hooks/useMaterial';

// ── Breakpoints (mirror tokens from theme) ────────────────
const tablet = '@media (max-width: 1024px)';
const mobile = '@media (max-width: 768px)';
const motionSafe = '@media (prefers-reduced-motion: no-preference)';

const styles = stylex.create({
  rail: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 64,
    height: '100svh',
    position: 'fixed',
    top: 0,
    left: 0,
    background: '#f8f7fa',
    borderRight: '1px solid #e5e4e7',
    padding: '12px 0',
    gap: 8,
    zIndex: 100,
    // Tablet: collapsible via translate
    [tablet]: {
      transform: 'translateX(-64px)',
      opacity: 0,
      pointerEvents: 'none' as const,
      transitionProperty: 'transform, opacity',
      transitionDuration: '0.2s',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
    [mobile]: {
      width: '100%',
      maxWidth: 280,
      boxShadow: '4px 0 24px rgba(0,0,0,0.1)',
    },
  },
  railVisible: {
    [tablet]: {
      transform: 'translateX(0)',
      opacity: 1,
      pointerEvents: 'auto' as const,
    },
  },

  // Mobile overlay backdrop
  overlay: {
    display: 'none',
    [mobile]: {
      display: 'block',
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.3)',
      zIndex: 99,
    },
  },
  overlayHidden: {
    [mobile]: {
      display: 'none',
    },
  },
  // Desktop: always visible
  railDesktop: {
    [tablet]: {
      transform: 'none',
      opacity: 1,
      pointerEvents: 'auto' as const,
      transition: 'none',
    },
  },

  navItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: '#6b6375',
    cursor: 'pointer',
    [motionSafe]: {
      transition: 'all 0.15s ease',
    },
    ':hover': {
      background: '#ecedf9',
      color: '#6366f1',
    },
  },
  navItemActive: {
    background: '#ecedf9',
    color: '#6366f1',
  },
  divider: {
    width: 24,
    height: 1,
    background: '#e5e4e7',
    margin: '4px 0',
  },
  chip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    padding: '6px 0',
    borderRadius: 8,
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
    color: '#6b6375',
    textAlign: 'center',
    gap: 2,
    cursor: 'default',
  },
  chipSubject: {
    background: '#ecedf9',
    color: '#6366f1',
  },
  chipMaterial: {
    background: '#fef3e6',
    color: '#c4841d',
  },
  chipIcon: {
    opacity: 0.7,
  },
  chipLabel: {
    lineHeight: 1.2,
    wordBreak: 'break-all',
    maxWidth: 48,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  spacer: {
    flex: 1,
  },
  // Mobile menu toggle button
  menuButton: {
    display: 'none',
    [mobile]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'fixed',
      top: 12,
      left: 12,
      width: 40,
      height: 40,
      borderRadius: 10,
      border: '1px solid #e5e4e7',
      background: '#fff',
      color: '#6b6375',
      cursor: 'pointer',
      zIndex: 101,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    },
    ':hover': {
      background: '#f8f7fa',
      color: '#6366f1',
    },
  },
});

interface WorkspaceRailProps {
  subjectId?: string;
  materialId?: string;
  isLibrary: boolean;
  onNavigate: (route: AppRoute) => void;
}

export function WorkspaceRail({ subjectId, materialId, isLibrary, onNavigate }: WorkspaceRailProps) {
  const { subject } = useSubject(subjectId);
  const { material } = useMaterial(materialId);
  const [isOpen, setIsOpen] = useState(false);

  // Close drawer on navigation (mobile)
  const handleNavigate = useCallback(
    (route: AppRoute) => {
      setIsOpen(false);
      onNavigate(route);
    },
    [onNavigate],
  );

  // Close drawer on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        {...stylex.props(styles.menuButton)}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay backdrop */}
      <div
        {...stylex.props(styles.overlay, !isOpen && styles.overlayHidden)}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <nav
        {...stylex.props(
          styles.rail,
          isOpen && styles.railVisible,
        )}
        aria-label="Workspace navigation"
      >
        <button
          type="button"
          {...stylex.props(styles.navItem, isLibrary && styles.navItemActive)}
          onClick={() => handleNavigate({ kind: 'library' })}
          title="Home"
          aria-label="Home"
          aria-current={isLibrary ? 'page' : undefined}
        >
          <Home size={20} />
        </button>

        {!isLibrary && (
          <>
            <div {...stylex.props(styles.divider)} aria-hidden="true" />
            {subject && (
              <div
                {...stylex.props(styles.chip, styles.chipSubject)}
                title={subject.title}
                role="status"
                aria-label={`Subject: ${subject.title}`}
              >
                <GraduationCap size={12} {...stylex.props(styles.chipIcon)} />
                <span {...stylex.props(styles.chipLabel)}>
                  {subject.title.substring(0, 3).toUpperCase()}
                </span>
              </div>
            )}
            {material && (
              <div
                {...stylex.props(styles.chip, styles.chipMaterial)}
                title={material.title}
                role="status"
                aria-label={`Material: ${material.title}`}
              >
                <BookText size={12} {...stylex.props(styles.chipIcon)} />
                <span {...stylex.props(styles.chipLabel)}>
                  {material.title.substring(0, 3).toUpperCase()}
                </span>
              </div>
            )}
          </>
        )}
      </nav>
    </>
  );
}
