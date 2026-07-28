import * as stylex from '@stylexjs/stylex';
import { Home, BookText, GraduationCap } from 'lucide-react';
import type { AppRoute } from '../../../app/layouts/AppShell';
import { useSubject } from '../../../shared/hooks/useSubject';
import { useMaterial } from '../../../shared/hooks/useMaterial';

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
    transition: 'all 0.15s ease',
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
  },
  spacer: {
    flex: 1,
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

  return (
    <nav {...stylex.props(styles.rail)}>
      <button
        type="button"
        {...stylex.props(styles.navItem, isLibrary && styles.navItemActive)}
        onClick={() => onNavigate({ kind: 'library' })}
        title="Home"
        aria-label="Home"
      >
        <Home size={20} />
      </button>

      {!isLibrary && (
        <>
          <div {...stylex.props(styles.divider)} />
          {subject && (
            <div {...stylex.props(styles.chip, styles.chipSubject)} title={subject.title}>
              <GraduationCap size={12} {...stylex.props(styles.chipIcon)} />
              <span {...stylex.props(styles.chipLabel)}>
                {subject.title.substring(0, 3).toUpperCase()}
              </span>
            </div>
          )}
          {material && (
            <div {...stylex.props(styles.chip, styles.chipMaterial)} title={material.title}>
              <BookText size={12} {...stylex.props(styles.chipIcon)} />
              <span {...stylex.props(styles.chipLabel)}>
                {material.title.substring(0, 3).toUpperCase()}
              </span>
            </div>
          )}
        </>
      )}
    </nav>
  );
}
