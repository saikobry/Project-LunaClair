import * as stylex from '@stylexjs/stylex';
import { Home, BookText, GraduationCap, Tag, Focus, TrendingUp, FileUp, Compass } from 'lucide-react';
import type { AppRoute } from '../routing/routing';
import { useSubject } from '../../features/catalog/subjects/hooks/queries/useSubject';
import { useMaterial } from '../../features/catalog/materials/hooks/queries/useMaterial';
import { sidebarStyles } from './sidebar/sidebar.stylex';
import { usePillIndicator } from './sidebar/usePillIndicator';
import { useFocusModeMorph } from './sidebar/useFocusModeMorph';
import { SidebarFooter } from './sidebar/SidebarFooter';
import { InstallRow } from './sidebar/InstallRow';

export interface AppSidebarProps {
  subjectId?: string;
  materialId?: string;
  /** Which of the main nav sections is current. `'none'` when a
   *  subject/material/quiz route owns the screen (context links take over). */
  active: 'library' | 'explore' | 'available' | 'import' | 'analytics' | 'terms' | 'none';
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onNavigate: (route: AppRoute) => void;
  /** Opens the install instructions dialog (PWA opt-in entry). */
  onOpenInstallInfo?: () => void;
}

export function AppSidebar({
  subjectId,
  materialId,
  active,
  isFocusMode,
  onToggleFocusMode,
  onNavigate,
  onOpenInstallInfo,
}: AppSidebarProps) {
  const { subject } = useSubject(subjectId);
  const { material } = useMaterial(materialId);

  const isSubjectActive = active === 'none' && Boolean(subject) && !material;
  const isMaterialActive = active === 'none' && Boolean(material);

  const { wrapperRef, pillRef, sectionsRef } = usePillIndicator({
    active,
    isSubjectActive,
    isMaterialActive,
    isFocusMode,
    hasSubject: Boolean(subject),
    hasMaterial: Boolean(material),
  });

  const navRef = useFocusModeMorph(isFocusMode);

  return (
    <nav
      ref={navRef}
      {...stylex.props(sidebarStyles.navContainer)}
      aria-label="Main Navigation"
    >
      <div ref={wrapperRef} {...stylex.props(sidebarStyles.wrapper)}>
        {/* Active pill indicator */}
        <div ref={pillRef} {...stylex.props(sidebarStyles.activePill)} />

        {/* Navigation Items */}
        <div ref={sectionsRef} {...stylex.props(sidebarStyles.navSection)}>
          <div {...stylex.props(sidebarStyles.sectionLabel)}>Navigation</div>

          <button
            type="button"
            {...stylex.props(sidebarStyles.navItem, active === 'library' && sidebarStyles.navItemActive)}
            onClick={() => onNavigate({ kind: 'library' })}
            aria-current={active === 'library' ? 'page' : undefined}
            title="Library"
          >
            <Home size={18} />
            <span {...stylex.props(sidebarStyles.navLabel)}>Library</span>
          </button>

          <button
            type="button"
            {...stylex.props(
              sidebarStyles.navItem,
              (active === 'explore' || active === 'available') && sidebarStyles.navItemActive,
            )}
            onClick={() => onNavigate({ kind: 'explore' })}
            aria-current={active === 'explore' || active === 'available' ? 'page' : undefined}
            title="Explore Content"
          >
            <Compass size={18} />
            <span {...stylex.props(sidebarStyles.navLabel)}>Explore</span>
          </button>

          <button
            type="button"
            {...stylex.props(sidebarStyles.navItem, active === 'import' && sidebarStyles.navItemActive)}
            onClick={() => onNavigate({ kind: 'import' })}
            aria-current={active === 'import' ? 'page' : undefined}
            title="Import Content"
          >
            <FileUp size={18} />
            <span {...stylex.props(sidebarStyles.navLabel)}>Import</span>
          </button>

          <button
            type="button"
            {...stylex.props(sidebarStyles.navItem, active === 'analytics' && sidebarStyles.navItemActive)}
            onClick={() => onNavigate({ kind: 'analytics' })}
            aria-current={active === 'analytics' ? 'page' : undefined}
            title="Learning Insights & Analytics"
          >
            <TrendingUp size={18} />
            <span {...stylex.props(sidebarStyles.navLabel)}>Insights</span>
          </button>

          <button
            type="button"
            {...stylex.props(sidebarStyles.navItem, active === 'terms' && sidebarStyles.navItemActive)}
            onClick={() => onNavigate({ kind: 'terms' })}
            aria-current={active === 'terms' ? 'page' : undefined}
            title="Manage Terms"
          >
            <Tag size={18} />
            <span {...stylex.props(sidebarStyles.navLabel)}>Terms</span>
          </button>

          {active === 'none' && (
            <>
              <div {...stylex.props(sidebarStyles.divider)} aria-hidden="true" />

              {subject && (
                <button
                  type="button"
                  {...stylex.props(
                    sidebarStyles.navItem,
                    isSubjectActive && sidebarStyles.navItemActive,
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
                  <span {...stylex.props(sidebarStyles.navLabel)}>{subject.title}</span>
                </button>
              )}

              {material && (
                <button
                  type="button"
                  {...stylex.props(
                    sidebarStyles.navItem,
                    isMaterialActive && sidebarStyles.navItemMaterialActive,
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
                  <span {...stylex.props(sidebarStyles.navLabel)}>{material.title}</span>
                </button>
              )}
            </>
          )}

          {/* PWA install entry (desktop/tablet) — quiet opt-in */}
          {onOpenInstallInfo && <InstallRow onClick={onOpenInstallInfo} />}

          {/* Mobile-only Focus Mode entry */}
          <button
            type="button"
            {...stylex.props(sidebarStyles.mobileFocusButton)}
            onClick={onToggleFocusMode}
            aria-label="Enter Focus Mode"
            title="Enter Focus Mode"
          >
            <Focus size={18} />
          </button>
        </div>
      </div>

      <SidebarFooter onToggleFocusMode={onToggleFocusMode} />
    </nav>
  );
}
