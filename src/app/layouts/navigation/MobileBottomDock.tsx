import { useRef, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Home, BookText, GraduationCap, Tag, Focus, TrendingUp, FileUp, Compass } from 'lucide-react';
import gsap from 'gsap';
import type { ViewportNavProps } from './navigation.types';

const nonMobile = '@media (min-width: 769px)';

export function MobileBottomDock({
  active,
  isFocusMode,
  onToggleFocusMode,
  onNavigate,
  subject,
  material,
}: ViewportNavProps) {
  const dockRef = useRef<HTMLElement>(null);
  const navGroupRef = useRef<HTMLDivElement>(null);
  const focusBtnRef = useRef<HTMLButtonElement>(null);
  const didInitialAnim = useRef(false);

  const isSubjectActive = active === 'none' && Boolean(subject) && !material;
  const isMaterialActive = active === 'none' && Boolean(material);

  useEffect(() => {
    const dock = dockRef.current;
    const navGroup = navGroupRef.current;
    const focusBtn = focusBtnRef.current;
    if (!dock || !navGroup || !focusBtn) return;

    const expandedState = {
      width: 'calc(100% - 32px)',
      height: 60,
      borderRadius: '20px',
      paddingLeft: 8,
      paddingRight: 8,
      boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.08)',
    };

    const collapsedState = {
      width: 44,
      height: 44,
      borderRadius: '14px',
      paddingLeft: 0,
      paddingRight: 0,
      boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.18)',
    };

    if (!didInitialAnim.current) {
      didInitialAnim.current = true;
      if (isFocusMode) {
        gsap.set(dock, collapsedState);
        gsap.set(navGroup, { autoAlpha: 0, display: 'none' });
      } else {
        gsap.set(dock, expandedState);
        gsap.set(navGroup, { autoAlpha: 1, display: 'flex' });
      }
      return;
    }

    const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

    if (isFocusMode) {
      // 1. Hide navGroup in place
      tl.to(navGroup, {
        autoAlpha: 0,
        duration: 0.1,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(navGroup, { display: 'none' });
        },
      }, 0);

      // 2. Contract dock horizontally into the 44x44 card
      tl.to(dock, {
        ...collapsedState,
        duration: 0.26,
        ease: 'power2.out',
      }, 0.04);
    } else {
      // 1. Expand dock horizontally
      tl.to(dock, {
        ...expandedState,
        duration: 0.28,
        ease: 'power3.out',
      }, 0);

      // 2. Fade navGroup back in
      gsap.set(navGroup, { display: 'flex' });
      tl.fromTo(navGroup,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.2, ease: 'power2.out' },
        0.1
      );
    }
  }, [isFocusMode]);

  // Keep GSAP inline styles accurate during window resize across breakpoints
  useEffect(() => {
    const dock = dockRef.current;
    const navGroup = navGroupRef.current;
    if (!dock || !navGroup) return;

    const handleResize = () => {
      if (isFocusMode) {
        gsap.set(dock, {
          width: 44,
          height: 44,
          borderRadius: '14px',
          paddingLeft: 0,
          paddingRight: 0,
        });
        gsap.set(navGroup, { autoAlpha: 0, display: 'none' });
      } else {
        gsap.set(dock, {
          width: 'calc(100% - 32px)',
          height: 60,
          borderRadius: '20px',
          paddingLeft: 8,
          paddingRight: 8,
        });
        gsap.set(navGroup, { autoAlpha: 1, display: 'flex' });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFocusMode]);

  return (
    <nav
      ref={dockRef}
      {...stylex.props(styles.mobileDock, isFocusMode && styles.mobileDockCollapsed)}
      aria-label="Mobile Bottom Navigation"
    >
      <div ref={navGroupRef} {...stylex.props(styles.navGroup)}>
        <button
          type="button"
          {...stylex.props(styles.dockButton, active === 'library' && styles.dockButtonActive)}
          onClick={() => onNavigate({ kind: 'library' })}
          aria-current={active === 'library' ? 'page' : undefined}
          title="Library"
        >
          <Home size={20} />
        </button>

        <button
          type="button"
          {...stylex.props(
            styles.dockButton,
            (active === 'explore' || active === 'available') && styles.dockButtonActive,
          )}
          onClick={() => onNavigate({ kind: 'explore' })}
          aria-current={active === 'explore' || active === 'available' ? 'page' : undefined}
          title="Explore Content"
        >
          <Compass size={20} />
        </button>

        <button
          type="button"
          {...stylex.props(styles.dockButton, active === 'import' && styles.dockButtonActive)}
          onClick={() => onNavigate({ kind: 'import' })}
          aria-current={active === 'import' ? 'page' : undefined}
          title="Import Content"
        >
          <FileUp size={20} />
        </button>

        <button
          type="button"
          {...stylex.props(styles.dockButton, active === 'analytics' && styles.dockButtonActive)}
          onClick={() => onNavigate({ kind: 'analytics' })}
          aria-current={active === 'analytics' ? 'page' : undefined}
          title="Learning Insights & Analytics"
        >
          <TrendingUp size={20} />
        </button>

        <button
          type="button"
          {...stylex.props(styles.dockButton, active === 'terms' && styles.dockButtonActive)}
          onClick={() => onNavigate({ kind: 'terms' })}
          aria-current={active === 'terms' ? 'page' : undefined}
          title="Manage Terms"
        >
          <Tag size={20} />
        </button>

        {active === 'none' && (
          <>
            {subject && (
              <button
                type="button"
                {...stylex.props(
                  styles.dockButton,
                  isSubjectActive && styles.dockButtonActive,
                )}
                onClick={() =>
                  onNavigate({
                    kind: 'subject',
                    subjectId: subject.id,
                    activeTab: 'materials',
                  })
                }
                aria-current={isSubjectActive ? 'page' : undefined}
                title={`Subject: ${subject.title}`}
              >
                <GraduationCap size={20} />
              </button>
            )}

            {material && (
              <button
                type="button"
                {...stylex.props(
                  styles.dockButton,
                  isMaterialActive && styles.dockButtonActive,
                )}
                onClick={() =>
                  onNavigate({
                    kind: 'workspace',
                    workspace: 'material',
                    materialId: material.id,
                    activeTab: 'read',
                  })
                }
                aria-current={isMaterialActive ? 'page' : undefined}
                title={`Material: ${material.title}`}
              >
                <BookText size={20} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Focus Mode trigger / restore button */}
      <button
        ref={focusBtnRef}
        type="button"
        {...stylex.props(
          styles.dockButton,
          styles.focusButton,
          isFocusMode && styles.focusButtonCollapsed,
        )}
        onClick={onToggleFocusMode}
        aria-label={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
        title={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
      >
        <Focus size={20} />
      </button>
    </nav>
  );
}

const styles = stylex.create({
  mobileDock: {
    position: 'fixed',
    bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
    left: 16,
    width: 'calc(100% - 32px)',
    height: 60,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.08)',
    backgroundColor: 'var(--color-background-surface)',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 8,
    boxSizing: 'border-box',
    overflow: 'hidden',
    zIndex: 150,
    pointerEvents: 'auto',
    [nonMobile]: {
      display: 'none',
    },
  },
  mobileDockCollapsed: {
    justifyContent: 'center',
    paddingLeft: 0,
    paddingRight: 0,
  },
  navGroup: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  dockButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease',
    outline: 'none',
    flexShrink: 0,
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
      color: 'var(--color-text-primary)',
    },
  },
  dockButtonActive: {
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
  },
  focusButton: {
    backgroundColor: 'var(--color-background-muted)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-secondary)',
    flexShrink: 0,
    ':hover': {
      backgroundColor: 'var(--color-accent-muted)',
      borderColor: 'var(--color-accent)',
      color: 'var(--color-accent)',
    },
  },
  focusButtonCollapsed: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    color: 'var(--color-text-secondary)',
    ':hover': {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      color: 'var(--color-accent)',
    },
  },
});
