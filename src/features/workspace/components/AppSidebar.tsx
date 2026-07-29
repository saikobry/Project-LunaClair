import * as stylex from '@stylexjs/stylex';
import { Home, BookText, GraduationCap } from 'lucide-react';
import type { AppRoute } from '../../../app/layouts/AppShell';
import { useSubject } from '../../../shared/hooks/useSubject';
import { useMaterial } from '../../../shared/hooks/useMaterial';
import logoSvg from '../../../assets/logo.svg';

const tablet = '@media (min-width: 769px) and (max-width: 1023px)';
const mobile = '@media (max-width: 768px)';

const styles = stylex.create({
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
      width: 24,
      height: 1,
      margin: '4px 0',
    },
    [mobile]: {
      width: 1,
      height: 24,
      margin: '0 4px',
    },
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

  const isSubjectActive = !isLibrary && Boolean(subject) && !material;
  const isMaterialActive = !isLibrary && Boolean(material);

  return (
    <nav {...stylex.props(styles.navContainer)} aria-label="Main Navigation">
      <div>
        {/* Desktop Brand Header */}
        <div {...stylex.props(styles.brandHeader)}>
          <div {...stylex.props(styles.brandIcon)}>
            <img src={logoSvg} alt="LunaClair" {...stylex.props(styles.brandLogo)} />
          </div>
          <span {...stylex.props(styles.brandTitle)}>Project LunaClair</span>
        </div>

        {/* Navigation Items */}
        <div {...stylex.props(styles.navSection)}>
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
