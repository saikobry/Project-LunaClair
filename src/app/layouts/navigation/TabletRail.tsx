import { useRef, useLayoutEffect, useEffect, Fragment } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Focus } from 'lucide-react';
import gsap from 'gsap';
import type { ViewportNavProps } from './navigation.types';
import { PRIMARY_NAV_ITEMS } from './navItems';
import { CompactCollectionsPopover } from './CompactCollectionsPopover';
import logoSvg from '../../../assets/logo.svg';


/** Combined top + bottom dock insets: the full-height rail fills everything between. */
const RAIL_VERTICAL_INSETS_PX = 32;

export function TabletRail({
  active,
  isFocusMode,
  onToggleFocusMode,
  onNavigate,
  collectionId,
}: ViewportNavProps) {
  const railRef = useRef<HTMLElement>(null);
  const navGroupRef = useRef<HTMLDivElement>(null);
  const focusBtnRef = useRef<HTMLButtonElement>(null);
  const didInitialAnim = useRef(false);

  useLayoutEffect(() => {
    const rail = railRef.current;
    const navGroup = navGroupRef.current;
    const focusBtn = focusBtnRef.current;
    if (!rail || !navGroup || !focusBtn) return;

    const isTabletViewport = window.matchMedia('(min-width: 769px) and (max-width: 1023px)').matches;
    if (!isTabletViewport) return;

    // Fixed dimensions to prevent layout recalculation during interpolation
    // Full-height rail: 16px top + 16px bottom insets (bottom-anchored, so no
    // `top` is needed — the height alone lands the top edge at 16px).
    const expandedHeight = window.innerHeight - RAIL_VERTICAL_INSETS_PX;
    const collapsedHeight = 44;

    const expandedState = {
      height: expandedHeight,
      width: 60,
      borderRadius: '24px',
      paddingTop: 16,
      paddingBottom: 8,
      boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.08)',
    };

    const collapsedState = {
      height: collapsedHeight,
      width: 44,
      borderRadius: '14px',
      paddingTop: 0,
      paddingBottom: 0,
      boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.18)',
    };

    if (!didInitialAnim.current) {
      didInitialAnim.current = true;
      if (isFocusMode) {
        gsap.set(rail, collapsedState);
        gsap.set(navGroup, { autoAlpha: 0, display: 'none' });
        gsap.set(focusBtn, { bottom: 0 });
      } else {
        gsap.set(rail, expandedState);
        gsap.set(navGroup, { autoAlpha: 1, display: 'flex' });
        gsap.set(focusBtn, { bottom: 8 });
      }
      return;
    }

    const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

    if (isFocusMode) {
      // Step 1: Immediately hide upper icons in-place
      tl.to(navGroup, {
        opacity: 0,
        duration: 0.1,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(navGroup, { display: 'none' });
        },
      }, 0);

      // Step 2: Settle the button onto the bottom edge alongside rail collapse
      tl.to(focusBtn, { bottom: 0, duration: 0.24, ease: 'power2.out' }, 0.08);

      // Step 3: Shrink the rail smoothly down to the Focus icon position
      tl.to(rail, {
        height: 44,
        width: 44,
        borderRadius: '14px',
        boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.18)',
        duration: 0.24,
        ease: 'power2.out',
      }, 0.08);
    } else {
      // Step 1: Animate button back up to padding offset when expanding
      tl.to(focusBtn, { bottom: 8, duration: 0.28, ease: 'power3.out' }, 0);

      // Step 2: Expand container height upwards
      tl.to(rail, {
        ...expandedState,
        duration: 0.28,
        ease: 'power3.out',
      }, 0);

      // Step 3: Restore navGroup display and slide-fade down into view
      gsap.set(navGroup, { display: 'flex' });
      tl.fromTo(
        navGroup,
        { autoAlpha: 0, y: -16, scale: 0.9 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.22, ease: 'power2.out' },
        0.1
      );
    }
  }, [isFocusMode]);

  // Window Resize Listener
  useEffect(() => {
    const rail = railRef.current;
    const navGroup = navGroupRef.current;
    const focusBtn = focusBtnRef.current;
    if (!rail || !navGroup || !focusBtn) return;

    const handleResize = () => {
      const expandedHeight = window.innerHeight - RAIL_VERTICAL_INSETS_PX;
      if (isFocusMode) {
        gsap.set(rail, {
          height: 44,
          width: 44,
          borderRadius: '14px',
          paddingTop: 0,
          paddingBottom: 0,
        });
        gsap.set(navGroup, { autoAlpha: 0, display: 'none' });
        gsap.set(focusBtn, { bottom: 0 });
      } else {
        gsap.set(rail, {
          height: expandedHeight,
          width: 60,
          borderRadius: '24px',
          paddingTop: 16,
          paddingBottom: 8,
        });
        gsap.set(navGroup, { autoAlpha: 1, display: 'flex', y: 0, scale: 1 });
        gsap.set(focusBtn, { bottom: 8 });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFocusMode]);

  return (
    <nav
      ref={railRef}
      {...stylex.props(styles.tabletRail)}
      aria-label="Tablet Navigation"
    >
      <div ref={navGroupRef} {...stylex.props(styles.navGroup)}>
        {/* Rail logo: the tablet home for the brand (logo-only; the header
            keeps the full lockup on mobile only). Inside the fading group so
            Focus Mode collapse takes it with the nav icons. Static mark. */}
        <div data-brand-source="rail" {...stylex.props(styles.logoButton)}>
          <img src={logoSvg} alt="" aria-hidden="true" data-brand-logo="rail" {...stylex.props(styles.logo, isFocusMode && styles.logoHidden)} />
        </div>
        {PRIMARY_NAV_ITEMS.map((item) => {
          const isActive = item.isActive(active);
          const isExplore = item.id === 'explore';
          return (
            <Fragment key={item.id}>
              <button
                type="button"
                {...stylex.props(styles.iconButton, isActive && styles.iconButtonActive)}
                onClick={() => onNavigate(item.route)}
                aria-current={isActive ? 'page' : undefined}
                title={item.title}
              >
                <item.icon size={20} />
              </button>
              {isExplore && (
                <CompactCollectionsPopover
                  placement="rail"
                  activeCollectionId={collectionId}
                  onNavigate={onNavigate}
                />
              )}
            </Fragment>
          );
        })}

      </div>

      {/* Focus Mode Trigger / Restore button */}
      <button
        ref={focusBtnRef}
        type="button"
        {...stylex.props(
          styles.iconButton,
          styles.focusButton,
          isFocusMode && styles.focusButtonCollapsed,
        )}
        onClick={onToggleFocusMode}
        aria-label={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
        title={isFocusMode ? 'Exit Focus Mode (Cmd/Ctrl+B)' : 'Enter Focus Mode (Cmd/Ctrl+B)'}
      >
        <Focus size={20} />
      </button>
    </nav>
  );
}

const styles = stylex.create({
  tabletRail: {
    position: 'fixed',
    bottom: 16,
    left: 16,
    width: 60,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.08)',
    backgroundColor: 'var(--color-background-surface)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 8,
    paddingLeft: 0,
    paddingRight: 0,
    boxSizing: 'border-box',
    overflow: 'hidden', // Clips child content while shrinking to avoid ghosting
    zIndex: 150,
    pointerEvents: 'auto',
    '@media (max-width: 768px), (min-width: 1024px)': {
      display: 'none',
    },
  },
  navGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    flexShrink: 0,
  },
  /** Rail logo mark: same 44px footprint as the nav icons. Static, not a link. */
  logoButton: {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 4,
  },
  logo: {
    width: 24,
    height: 24,
    objectFit: 'contain',
    display: 'block',
    // Same quick-hide contract as the sidebar brand image: snap out on Focus
    // entry for the FLIP illusion, restore with the chrome on exit.
    transition: 'opacity 0.2s ease',
  },
  logoHidden: {
    opacity: 0,
    transition: 'opacity 0.08s ease-in',
  },
  iconButton: {
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
  iconButtonActive: {
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
    ':hover': {
      backgroundColor: 'var(--color-accent-muted)',
      color: 'var(--color-accent)',
    },
  },
  focusButton: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 2,
    backgroundColor: 'var(--color-background-muted)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-secondary)',
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
