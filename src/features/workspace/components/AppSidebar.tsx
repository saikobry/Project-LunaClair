import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import * as stylex from '@stylexjs/stylex';
import { Home, BookText, GraduationCap } from 'lucide-react';
import type { AppRoute } from '../../../app/layouts/AppShell';
import { useSubject } from '../../../shared/hooks/useSubject';
import { useMaterial } from '../../../shared/hooks/useMaterial';
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
  brandHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
    paddingRight: 8,
    marginBottom: 20,
    [tablet]: {
      display: 'none',
    },
    [mobile]: {
      display: 'none',
    },
  },
  brandIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    flexShrink: 0,
  },
  brandLogo: {
    width: 36,
    height: 36,
    objectFit: 'contain',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.5px',
    color: 'var(--color-text-primary)',
  },
  navSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
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
    // left, top, width, height set dynamically by GSAP
  },
  footer: {
    paddingLeft: 8,
    fontSize: 12,
    color: 'var(--color-text-disabled)',
    [tablet]: {
      display: 'none',
    },
    [mobile]: {
      display: 'none',
    },
  },
});

export interface AppSidebarProps {
  subjectId?: string;
  materialId?: string;
  isLibrary: boolean;
  onNavigate: (route: AppRoute) => void;
}

export function AppSidebar({ subjectId, materialId, isLibrary, onNavigate }: AppSidebarProps) {
  const { subject } = useSubject(subjectId);
  const { material } = useMaterial(materialId);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);

  const isSubjectActive = !isLibrary && Boolean(subject) && !material;
  const isMaterialActive = !isLibrary && Boolean(material);

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

  // ── Reposition whenever active route changes ───────────────────
  useEffect(() => {
    requestAnimationFrame(() => repositionPill(true));
  }, [isLibrary, isSubjectActive, isMaterialActive]);

  // ── Reposition on viewport resize (desktop ↔ tablet etc.) ──────
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Reposition after a brief delay so layout has settled
    const handleResize = () => requestAnimationFrame(() => repositionPill(false));

    const ro = new ResizeObserver(handleResize);
    ro.observe(wrapper);

    return () => ro.disconnect();
  }, []);

  // ── Gentle entrance animation for nav items ───────────────────
  // One-time fade+slide-up on mount, plus re-animation when a new nav
  // item appears (subject or material going from undefined → defined).
  // Does NOT re-fire on every navigation — only when new content mounts.
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

    // Initial mount or a new item just appeared → gentle fade+slide-up
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
    <nav {...stylex.props(styles.navContainer)} aria-label="Main Navigation">
      <div ref={wrapperRef} {...stylex.props(styles.wrapper)}>
        {/* Desktop Brand Header */}
        <div {...stylex.props(styles.brandHeader)}>
          <div {...stylex.props(styles.brandIcon)}>
            <img src={logoSvg} alt="LunaClair" {...stylex.props(styles.brandLogo)} />
          </div>
          <span {...stylex.props(styles.brandTitle)}>Project LunaClair</span>
        </div>

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

          {!isLibrary && (
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
        </div>
      </div>

      <div {...stylex.props(styles.footer)}>
        <span>Project LunaClair v1.0</span>
      </div>
    </nav>
  );
}
