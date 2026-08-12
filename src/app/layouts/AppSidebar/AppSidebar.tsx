import { useRef, useEffect, useLayoutEffect } from 'react';
import gsap from 'gsap';
import * as stylex from '@stylexjs/stylex';
import { Home, BookText, GraduationCap, Tag, Focus, Download } from 'lucide-react';
import type { AppRoute } from '../AppShell';
import { useSubject } from '../../../features/catalog/subjects/hooks/queries/useSubject';
import { useMaterial } from '../../../features/catalog/materials/hooks/queries/useMaterial';
import { isIOS, isStandalone } from '../installDetection';
import logoSvg from '../../../assets/logo.svg';

const tablet = '@media (min-width: 769px) and (max-width: 1023px)';
const mobile = '@media (max-width: 768px)';

const styles = stylex.create({
  wrapper: {
    position: 'relative',
  },
  navContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: 240,
    backgroundColor: 'var(--color-background-surface)',
    borderRightWidth: 1,
    borderRightStyle: 'solid',
    borderRightColor: 'var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 16,
    paddingRight: 16,
    boxSizing: 'border-box',
    zIndex: 100,
    [tablet]: {
      top: 16,
      left: 16,
      bottom: 16,
      width: 60,
      borderRadius: 24,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: 'var(--color-border)',
      boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.08)',
      paddingTop: 16,
      paddingBottom: 16,
      paddingLeft: 0,
      paddingRight: 0,
      alignItems: 'center',
      gap: 8,
    },
    [mobile]: {
      top: 'auto',
      bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      left: 16,
      right: 16,
      width: 'calc(100% - 32px)',
      height: 60,
      borderRadius: 20,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: 'var(--color-border)',
      boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.08)',
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 12,
      paddingRight: 12,
    },
  },
  navSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-start',
    [mobile]: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 'none',
    },
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: 'var(--color-text-disabled)',
    paddingLeft: 8,
    marginBottom: 6,
    [tablet]: {
      display: 'none',
    },
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
    [tablet]: {
      justifyContent: 'center',
      width: 44,
      height: 44,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      borderRadius: 16,
    },
    [mobile]: {
      justifyContent: 'center',
      width: 44,
      height: 44,
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      borderRadius: 16,
    },
  },
  navItemActive: {
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
    fontWeight: 600,
  },
  // Deliberate amber treatment for the material-active nav state — alpha-tint
  // background + amber-600. Distinct from the warning-muted role pair
  // (--color-on-warning-muted): this is a decorative 2.79:1 highlight on its
  // own tinted surface, not a badge, so it intentionally stays literal.
  navItemMaterialActive: {
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    color: '#d97706',
    fontWeight: 600,
  },
  navLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    [tablet]: {
      display: 'none',
    },
    [mobile]: {
      display: 'none',
    },
  },
  divider: {
    height: 1,
    backgroundColor: 'var(--color-border)',
    marginTop: 8,
    marginBottom: 8,
    opacity: 0.6,
    [tablet]: {
      width: 44,
      height: 1,
      margin: '4px 0',
    },
    [mobile]: {
      width: 1,
      height: 24,
      margin: '0 4px',
    },
  },
  activePill: {
    position: 'absolute',
    zIndex: 0,
    pointerEvents: 'none',
    opacity: 0,
    backgroundColor: 'var(--color-accent-muted)',
    borderRadius: 12,
  },
  // Unified bottom-left brand card: logo, version, and Focus Mode toggle
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'var(--color-border)',
    borderRadius: 16,
    backgroundColor: 'var(--color-background-surface)',
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-background-muted)',
    },
    // Tablet: the 60px rail already provides its own border/background —
    // strip the nested card so the logo & badge sit cleanly inside it.
    [tablet]: {
      borderStyle: 'none',
      backgroundColor: 'transparent',
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    },
    [mobile]: {
      display: 'none',
    },
  },
  // Desktop: 2-row brand card — row 1 brand identity, row 2 Focus trigger
  footerDesktop: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
    [tablet]: {
      display: 'none',
    },
  },
  footerRow1: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  footerRow1Badge: {
    marginLeft: 'auto',
  },
  footerRow2: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  footerTablet: {
    display: 'none',
    [tablet]: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
    },
  },
  footerLogo: {
    width: 22,
    height: 22,
    objectFit: 'contain',
    flexShrink: 0,
  },
  footerTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--color-text-primary)',
    // Full title — never truncate
    whiteSpace: 'nowrap',
  },
  footerFocusLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
  },
  footerFocusIcon: {
    marginLeft: 'auto',
    flexShrink: 0,
    color: 'var(--color-text-secondary)',
    [tablet]: {
      // Tablet rail stacks vertically — keep the icon centered there.
      marginLeft: 0,
    },
  },
  // Mobile-only Focus Mode entry button (touch devices have no keyboard)
  mobileFocusButton: {
    display: 'none',
    [mobile]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 44,
      flexShrink: 0,
      backgroundColor: 'transparent',
      borderStyle: 'none',
      borderRadius: 16,
      color: 'var(--color-text-secondary)',
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.15s ease',
      ':hover': {
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-primary)',
      },
    },
  },
  versionBadge: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.5px',
    color: 'var(--color-text-secondary)',
    backgroundColor: 'var(--color-background-muted)',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'var(--color-border)',
    borderRadius: 999,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 6,
    paddingRight: 6,
    whiteSpace: 'nowrap',
  },
  // Install row hides on mobile — the bottom dock is a cramped icon strip
  // and mobile iOS is served by the one-time InstallPrompt card instead.
  installRow: {
    [mobile]: {
      display: 'none',
    },
  },
  // Mobile: hide the divider alongside the button so no lone separator
  // appears in the bottom dock (the divider's own mobile style is a
  // vertical 1×24 line).
  installRowDivider: {
    [mobile]: {
      display: 'none',
    },
  },
});

export interface AppSidebarProps {
  subjectId?: string;
  materialId?: string;
  isLibrary: boolean;
  isTerms?: boolean;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onNavigate: (route: AppRoute) => void;
  /** Opens the install instructions dialog (PWA opt-in entry). */
  onOpenInstallInfo?: () => void;
}

export function AppSidebar({
  subjectId,
  materialId,
  isLibrary,
  isTerms = false,
  isFocusMode,
  onToggleFocusMode,
  onNavigate,
  onOpenInstallInfo,
}: AppSidebarProps) {
  const { subject } = useSubject(subjectId);
  const { material } = useMaterial(materialId);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);

  const isSubjectActive = !isLibrary && !isTerms && Boolean(subject) && !material;
  const isMaterialActive = !isLibrary && !isTerms && Boolean(material);

  // ── Helper: reposition the sliding pill to match the active nav button ──
  const repositionPill = (animate = false) => {
    if (!wrapperRef.current || !pillRef.current) return;

    const activeItem = wrapperRef.current.querySelector('button[aria-current="page"]');
    if (!activeItem) {
      if (animate) {
        gsap.to(pillRef.current, { opacity: 0, duration: 0.15, overwrite: 'auto' });
      } else {
        gsap.set(pillRef.current, { opacity: 0 });
      }
      return;
    }

    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const target = {
      left: itemRect.left - wrapperRect.left,
      top: itemRect.top - wrapperRect.top,
      width: itemRect.width,
      height: itemRect.height,
      opacity: 1,
    };

    if (animate) {
      gsap.to(pillRef.current, {
        ...target,
        duration: 0.32,
        ease: 'circ.out',
        overwrite: 'auto',
      });
    } else {
      gsap.set(pillRef.current, target);
    }
  };

  const navRef = useRef<HTMLElement>(null);
  const didInitialFocusAnim = useRef(false);

  // ── Focus Mode: morph the nav toward/away from the bottom-left corner ──
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    // Shrink into (or expand out of) the bottom-left corner, matching the
    // floating logo restore button position. The desktop sidebar is
    // edge-to-edge, so anchor the morph at the restore button's center;
    // the tablet rail and mobile bottom bar already touch that corner.
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const isTablet = window.matchMedia('(min-width: 769px) and (max-width: 1023px)').matches;
    const origin = isMobile || isTablet ? 'left bottom' : '38px calc(100% - 38px)';

    const hidden = {
      autoAlpha: 0,
      scale: 0.05,
      transformOrigin: origin,
      pointerEvents: 'none',
    };
    const visible = {
      autoAlpha: 1,
      scale: 1,
      transformOrigin: origin,
      pointerEvents: 'auto',
    };

    if (!didInitialFocusAnim.current) {
      didInitialFocusAnim.current = true;
      // Set (never animate) on first paint so a persisted Focus Mode
      // never flashes the rail before hiding.
      gsap.set(nav, isFocusMode ? hidden : visible);
      return;
    }

    gsap.to(nav, {
      ...(isFocusMode ? hidden : visible),
      duration: 0.35,
      ease: 'power2.inOut',
      overwrite: 'auto',
    });
  }, [isFocusMode]);

  // ── Reposition whenever active route changes ───────────────────
  useEffect(() => {
    requestAnimationFrame(() => repositionPill(true));
  }, [isLibrary, isTerms, isSubjectActive, isMaterialActive, isFocusMode]);

  // ── Reposition on viewport resize (desktop ↔ tablet etc.) ──────
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleResize = () => requestAnimationFrame(() => repositionPill(false));

    const ro = new ResizeObserver(handleResize);
    ro.observe(wrapper);

    return () => ro.disconnect();
  }, []);

  // ── Gentle entrance animation for nav items ───────────────────
  const didInitialEntrance = useRef(false);
  const prevHadSubject = useRef(false);
  const prevHadMaterial = useRef(false);

  useEffect(() => {
    const hasSubject = Boolean(subject);
    const hasMaterial = Boolean(material);
    const subjectJustAppeared = hasSubject && !prevHadSubject.current;
    const materialJustAppeared = hasMaterial && !prevHadMaterial.current;

    prevHadSubject.current = hasSubject;
    prevHadMaterial.current = hasMaterial;

    if (!sectionsRef.current) return;
    const items = sectionsRef.current.children;
    if (items.length === 0) return;

    if (!didInitialEntrance.current || subjectJustAppeared || materialJustAppeared) {
      didInitialEntrance.current = true;
      gsap.fromTo(
        items,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, stagger: 0.04, duration: 0.3, ease: 'power2.out', overwrite: 'auto' },
      );
    }
  }, [subject, material]);

  return (
    <nav
      ref={navRef}
      {...stylex.props(styles.navContainer)}
      aria-label="Main Navigation"
    >
      <div ref={wrapperRef} {...stylex.props(styles.wrapper)}>
        {/* Active pill indicator */}
        <div ref={pillRef} {...stylex.props(styles.activePill)} />

        {/* Navigation Items */}
        <div ref={sectionsRef} {...stylex.props(styles.navSection)}>
          <div {...stylex.props(styles.sectionLabel)}>Navigation</div>

          <button
            type="button"
            {...stylex.props(styles.navItem, isLibrary && styles.navItemActive)}
            onClick={() => onNavigate({ kind: 'library' })}
            aria-current={isLibrary ? 'page' : undefined}
            title="Library"
          >
            <Home size={18} />
            <span {...stylex.props(styles.navLabel)}>Library</span>
          </button>

          <button
            type="button"
            {...stylex.props(styles.navItem, isTerms && styles.navItemActive)}
            onClick={() => onNavigate({ kind: 'terms' })}
            aria-current={isTerms ? 'page' : undefined}
            title="Manage Terms"
          >
            <Tag size={18} />
            <span {...stylex.props(styles.navLabel)}>Terms</span>
          </button>

          {!isLibrary && !isTerms && (
            <>
              <div {...stylex.props(styles.divider)} aria-hidden="true" />

              {subject && (
                <button
                  type="button"
                  {...stylex.props(
                    styles.navItem,
                    isSubjectActive && styles.navItemActive,
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
                  <GraduationCap size={18} />
                  <span {...stylex.props(styles.navLabel)}>{subject.title}</span>
                </button>
              )}

              {material && (
                <button
                  type="button"
                  {...stylex.props(
                    styles.navItem,
                    isMaterialActive && styles.navItemMaterialActive,
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
                  <BookText size={18} />
                  <span {...stylex.props(styles.navLabel)}>{material.title}</span>
                </button>
              )}
            </>
          )}

          {/* PWA install entry (desktop/tablet) — quiet opt-in; see InstallRow */}
          {onOpenInstallInfo && <InstallRow onClick={onOpenInstallInfo} />}

          {/* Mobile-only Focus Mode entry */}
          <button
            type="button"
            {...stylex.props(styles.mobileFocusButton)}
            onClick={onToggleFocusMode}
            aria-label="Enter Focus Mode"
            title="Enter Focus Mode"
          >
            <Focus size={18} />
          </button>
        </div>
      </div>

      <button
        type="button"
        {...stylex.props(styles.footer)}
        onClick={onToggleFocusMode}
        aria-label="Enter Focus Mode"
        title="Enter Focus Mode (Cmd/Ctrl+B)"
      >
        <div {...stylex.props(styles.footerDesktop)}>
          <div {...stylex.props(styles.footerRow1)}>
            <img src={logoSvg} alt="LunaClair" {...stylex.props(styles.footerLogo)} />
            <span {...stylex.props(styles.footerTitle)}>Project LunaClair</span>
            <span
              {...stylex.props(styles.versionBadge, styles.footerRow1Badge)}
            >
              v1.0
            </span>
          </div>
          <div {...stylex.props(styles.footerRow2)}>
            <span {...stylex.props(styles.footerFocusLabel)}>Focus Mode (Cmd+B)</span>
            <Focus size={14} {...stylex.props(styles.footerFocusIcon)} aria-hidden="true" />
          </div>
        </div>
        <div {...stylex.props(styles.footerTablet)}>
          <img src={logoSvg} alt="LunaClair" {...stylex.props(styles.footerLogo)} />
          <span {...stylex.props(styles.versionBadge)}>v1.0</span>
          <Focus size={14} {...stylex.props(styles.footerFocusIcon)} aria-hidden="true" />
        </div>
      </button>
    </nav>
  );
}

/**
 * Quiet opt-in PWA install row (desktop/tablet). Hidden on mobile — the
 * iOS one-time card serves mobile iOS and Android uses its native menu —
 * and hidden when the app already runs installed (standalone). Copy
 * branches by platform: iOS users need the A2HS instructions; everyone
 * else uses the browser's native install affordance.
 */
function InstallRow({ onClick }: { onClick: () => void }) {
  const label = isIOS() ? 'Add to Home Screen' : 'Install app';
  if (isStandalone()) return null;
  return (
    <>
      {/* The divider must hide on mobile too — otherwise a lone vertical
          separator shows in the bottom dock above the hidden button. */}
      <div {...stylex.props(styles.divider, styles.installRowDivider)} aria-hidden="true" />
      <button
        type="button"
        {...stylex.props(styles.navItem, styles.installRow)}
        onClick={onClick}
        title={label}
      >
        <Download size={18} />
        <span {...stylex.props(styles.navLabel)}>{label}</span>
      </button>
    </>
  );
}
