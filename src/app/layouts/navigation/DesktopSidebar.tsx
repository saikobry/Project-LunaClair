import { useRef, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Home, BookText, GraduationCap, Tag, TrendingUp, FileUp, Compass } from 'lucide-react';
import gsap from 'gsap';
import type { ViewportNavProps } from './navigation.types';
import { styles } from './desktopSidebar.stylex';
import { DesktopTrapezoidButton } from './DesktopTrapezoidButton';

export function DesktopSidebar({
  active,
  isFocusMode,
  onToggleFocusMode,
  onNavigate,
  subject,
  material,
}: ViewportNavProps) {
  const containerRef = useRef<HTMLElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const didInitialFade = useRef(false);

  const isSubjectActive = active === 'none' && Boolean(subject) && !material;
  const isMaterialActive = active === 'none' && Boolean(material);

  // ── GSAP: Upper navigation link & container background fade ──
  useEffect(() => {
    const links = linksRef.current;
    const container = containerRef.current;
    if (!links || !container) return;

    if (!didInitialFade.current) {
      didInitialFade.current = true;
      if (isFocusMode) {
        gsap.set(links, { autoAlpha: 0, pointerEvents: 'none' });
        gsap.set(container, { backgroundColor: 'transparent', borderColor: 'transparent' });
      } else {
        gsap.set(links, { autoAlpha: 1, pointerEvents: 'auto' });
        gsap.set(container, { clearProps: 'backgroundColor,borderColor' });
      }
      return;
    }

    const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });

    if (isFocusMode) {
      tl.to(links, {
        autoAlpha: 0,
        y: 16,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(links, { pointerEvents: 'none' });
        },
      }, 0);

      tl.to(container, {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        duration: 0.24,
      }, 0.04);
    } else {
      tl.to(container, {
        backgroundColor: 'var(--color-background-surface)',
        borderColor: 'var(--color-border)',
        duration: 0.28,
        ease: 'power2.out',
      }, 0);

      gsap.set(links, { pointerEvents: 'auto' });
      tl.fromTo(links,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.24, ease: 'power2.out' },
        0.12
      );
    }
  }, [isFocusMode]);

  return (
    <nav
      ref={containerRef}
      {...stylex.props(styles.desktopNav)}
      aria-label="Desktop Navigation"
    >
      <div ref={linksRef} {...stylex.props(styles.linksWrapper)}>
        <div {...stylex.props(styles.navSection)}>
          <button
            type="button"
            {...stylex.props(styles.navItem, active === 'library' && styles.navItemActive)}
            onClick={() => onNavigate({ kind: 'library' })}
            aria-current={active === 'library' ? 'page' : undefined}
            title="Library"
          >
            <Home size={18} />
            <span {...stylex.props(styles.navLabel)}>Library</span>
          </button>

          <button
            type="button"
            {...stylex.props(
              styles.navItem,
              (active === 'explore' || active === 'available') && styles.navItemActive,
            )}
            onClick={() => onNavigate({ kind: 'explore' })}
            aria-current={active === 'explore' || active === 'available' ? 'page' : undefined}
            title="Explore Content"
          >
            <Compass size={18} />
            <span {...stylex.props(styles.navLabel)}>Explore</span>
          </button>

          <button
            type="button"
            {...stylex.props(styles.navItem, active === 'import' && styles.navItemActive)}
            onClick={() => onNavigate({ kind: 'import' })}
            aria-current={active === 'import' ? 'page' : undefined}
            title="Import Content"
          >
            <FileUp size={18} />
            <span {...stylex.props(styles.navLabel)}>Import</span>
          </button>

          <button
            type="button"
            {...stylex.props(styles.navItem, active === 'analytics' && styles.navItemActive)}
            onClick={() => onNavigate({ kind: 'analytics' })}
            aria-current={active === 'analytics' ? 'page' : undefined}
            title="Learning Insights & Analytics"
          >
            <TrendingUp size={18} />
            <span {...stylex.props(styles.navLabel)}>Insights</span>
          </button>

          <button
            type="button"
            {...stylex.props(styles.navItem, active === 'terms' && styles.navItemActive)}
            onClick={() => onNavigate({ kind: 'terms' })}
            aria-current={active === 'terms' ? 'page' : undefined}
            title="Manage Terms"
          >
            <Tag size={18} />
            <span {...stylex.props(styles.navLabel)}>Terms</span>
          </button>

          {active === 'none' && (
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

      {/* Connected Option A Rounded Trapezoid Drawer Button */}
      <DesktopTrapezoidButton
        isFocusMode={isFocusMode}
        onToggleFocusMode={onToggleFocusMode}
      />
    </nav>
  );
}
