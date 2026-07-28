import * as stylex from '@stylexjs/stylex';
import { Home, BookText, GraduationCap } from 'lucide-react';
import type { AppRoute } from '../../../app/layouts/AppShell';
import { useSubject } from '../../../shared/hooks/useSubject';
import { useMaterial } from '../../../shared/hooks/useMaterial';

const mobile = '@media (max-width: 768px)';
const motionSafe = '@media (prefers-reduced-motion: no-preference)';

const styles = stylex.create({
  floatingPanel: {
    position: 'fixed',
    top: 16,
    left: 16,
    bottom: 16,
    width: 60,
    borderRadius: 24,
    background: 'var(--color-background-surface)',
    border: '1px solid var(--color-border)',
    boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.03)',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 0',
    gap: 8,
    zIndex: 100,
    [mobile]: {
      top: 'auto',
      bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      left: 16,
      right: 16,
      width: 'calc(100% - 32px)',
      height: 60,
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      padding: '0 12px',
      borderRadius: 20,
    },
  },
  pillButton: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 16,
    border: 'none',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    outline: 'none',
    [motionSafe]: {
      transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.15s ease, color 0.15s ease, box-shadow 0.2s ease',
    },
    ':hover': {
      transform: 'translateY(-1px) scale(1.04)',
      background: 'var(--color-accent-muted)',
      color: 'var(--color-accent)',
    },
    ':active': {
      transform: 'scale(0.96)',
    },
    ':focus-visible': {
      boxShadow: '0 0 0 2px var(--color-background-surface), 0 0 0 4px var(--color-accent)',
    },
    [mobile]: {
      ':hover': {
        transform: 'none',
      },
    },
  },
  pillActive: {
    background: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
    ':hover': {
      background: 'var(--color-accent-muted)',
      color: 'var(--color-accent)',
    },
  },
  pillActiveSubject: {
    background: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
  },
  pillActiveMaterial: {
    background: 'rgba(217, 119, 6, 0.12)',
    color: '#d97706',
    boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)',
  },
  divider: {
    width: 24,
    height: 1,
    background: 'var(--color-border)',
    margin: '4px 0',
    opacity: 0.6,
    [mobile]: {
      width: 1,
      height: 24,
      margin: '0 4px',
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

  // Active route checks
  const isSubjectActive = !isLibrary && Boolean(subject) && !material;
  const isMaterialActive = !isLibrary && Boolean(material);

  return (
    <nav {...stylex.props(styles.floatingPanel)} aria-label="Workspace Navigation">
      <button
        type="button"
        {...stylex.props(styles.pillButton, isLibrary && styles.pillActive)}
        onClick={() => onNavigate({ kind: 'library' })}
        aria-label="Library Home"
        aria-current={isLibrary ? 'page' : undefined}
        title="Library"
      >
        <Home size={20} />
      </button>

      {!isLibrary && (
        <>
          <div {...stylex.props(styles.divider)} aria-hidden="true" />

          {subject && (
            <button
              type="button"
              {...stylex.props(
                styles.pillButton,
                isSubjectActive && styles.pillActiveSubject
              )}
              onClick={() =>
                onNavigate({
                  kind: 'subject',
                  subjectId: subject.id,
                  activeTab: 'materials',
                })
              }
              aria-label={`Subject: ${subject.title}`}
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
                styles.pillButton,
                isMaterialActive && styles.pillActiveMaterial
              )}
              onClick={() =>
                onNavigate({
                  kind: 'workspace',
                  workspace: 'material',
                  materialId: material.id,
                  activeTab: 'read',
                })
              }
              aria-label={`Material: ${material.title}`}
              aria-current={isMaterialActive ? 'page' : undefined}
              title={`Material: ${material.title}`}
            >
              <BookText size={20} />
            </button>
          )}
        </>
      )}
    </nav>
  );
}
