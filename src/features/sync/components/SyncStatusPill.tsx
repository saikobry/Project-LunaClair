import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  CheckCircle2,
  RefreshCw,
  WifiOff,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { formatSyncTime } from '../utils/formatSyncTime';
import { ConflictDraftsModal } from './ConflictDraftsModal';

export interface SyncStatusPillProps {
  className?: string;
  isCompact?: boolean;
  onClick?: () => void;
}

const spin = stylex.keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

// Tablet range, shared by the pill padding and the label visibility below.
const tablet = '@media (min-width: 769px) and (max-width: 1023px)';

const styles = stylex.create({
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    borderWidth: 1,
    borderStyle: 'solid',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    ':focus-visible': {
      boxShadow: '0 0 0 2px var(--color-accent)',
    },
    [tablet]: {
      paddingLeft: 6,
      paddingRight: 6,
      justifyContent: 'center',
    },
  },
  pillCompact: {
    paddingLeft: 5,
    paddingRight: 5,
    justifyContent: 'center',
    gap: 0,
  },
  synced: {
    color: 'var(--color-success)',
    backgroundColor: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
    borderColor: 'color-mix(in srgb, var(--color-success) 25%, transparent)',
    ':hover': {
      backgroundColor: 'color-mix(in srgb, var(--color-success) 15%, transparent)',
    },
  },
  syncing: {
    color: 'var(--color-accent)',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: 'rgba(99, 102, 241, 0.25)',
    ':hover': {
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
    },
  },
  offline: {
    color: 'var(--color-text-secondary)',
    backgroundColor: 'var(--color-background-muted)',
    borderColor: 'var(--color-border)',
    ':hover': {
      backgroundColor: 'var(--color-border)',
    },
  },
  error: {
    color: 'var(--color-error)',
    backgroundColor: 'var(--color-error-muted)',
    borderColor: 'color-mix(in srgb, var(--color-error) 25%, transparent)',
    ':hover': {
      backgroundColor: 'color-mix(in srgb, var(--color-error) 15%, transparent)',
    },
  },
  conflict: {
    color: 'var(--color-warning)',
    backgroundColor: 'var(--color-warning-muted)',
    borderColor: 'color-mix(in srgb, var(--color-warning) 35%, transparent)',
    ':hover': {
      backgroundColor: 'color-mix(in srgb, var(--color-warning) 22%, transparent)',
    },
  },
  iconSpin: {
    animationName: spin,
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },
  label: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    [tablet]: {
      display: 'none',
    },
  },
  labelCompact: {
    display: 'none',
  },
  badgeCount: {
    fontSize: 10,
    fontWeight: 700,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 5,
    paddingRight: 5,
    borderRadius: 999,
    backgroundColor: 'var(--color-warning)',
    color: '#ffffff',
    marginLeft: 2,
  },
});

export function SyncStatusPill({ isCompact, onClick }: SyncStatusPillProps) {
  const { state, conflictCount, lastSyncedAt, lastError, triggerSync } = useSyncStatus();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // If conflict drafts exist, highest priority is conflict indicator
  const hasConflicts = conflictCount > 0;

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    if (hasConflicts) {
      setIsModalOpen(true);
    } else if (state === 'idle' || state === 'error') {
      void triggerSync();
    }
  };

  const getTooltip = (): string => {
    if (hasConflicts) {
      return `${conflictCount} conflict${conflictCount > 1 ? 's' : ''} detected. Click to resolve.`;
    }
    if (state === 'syncing') {
      return 'Syncing changes with cloud...';
    }
    if (state === 'offline') {
      return 'Offline — edits will sync automatically when back online';
    }
    if (state === 'error') {
      return lastError ? `Sync error: ${lastError} (Click to retry)` : 'Sync error (Click to retry)';
    }
    return `${formatSyncTime(lastSyncedAt)} (Click to sync)`;
  };

  const renderContent = () => {
    if (hasConflicts) {
      return (
        <>
          <AlertTriangle size={14} color="var(--color-warning)" />
          <span {...stylex.props(styles.label, isCompact && styles.labelCompact)}>
            {conflictCount} conflict{conflictCount > 1 ? 's' : ''}
          </span>
          <span {...stylex.props(styles.badgeCount)} aria-hidden="true">
            {conflictCount}
          </span>
        </>
      );
    }

    switch (state) {
      case 'syncing':
        return (
          <>
            <span {...stylex.props(styles.iconSpin)}>
              <RefreshCw size={14} />
            </span>
            <span {...stylex.props(styles.label, isCompact && styles.labelCompact)}>
              Syncing...
            </span>
          </>
        );

      case 'offline':
        return (
          <>
            <WifiOff size={14} />
            <span {...stylex.props(styles.label, isCompact && styles.labelCompact)}>
              Offline
            </span>
          </>
        );

      case 'error':
        return (
          <>
            <AlertCircle size={14} color="var(--color-error)" />
            <span {...stylex.props(styles.label, isCompact && styles.labelCompact)}>
              Sync error
            </span>
          </>
        );

      case 'idle':
      default:
        return (
          <>
            <CheckCircle2 size={14} color="var(--color-success)" />
            <span {...stylex.props(styles.label, isCompact && styles.labelCompact)}>
              Synced
            </span>
          </>
        );
    }
  };

  const getStyleVariant = () => {
    if (hasConflicts) return styles.conflict;
    switch (state) {
      case 'syncing':
        return styles.syncing;
      case 'offline':
        return styles.offline;
      case 'error':
        return styles.error;
      case 'idle':
      default:
        return styles.synced;
    }
  };

  return (
    <>
      <button
        type="button"
        {...stylex.props(styles.pill, getStyleVariant(), isCompact && styles.pillCompact)}
        onClick={handleClick}
        title={getTooltip()}
        aria-label={getTooltip()}
      >
        {renderContent()}
      </button>

      <ConflictDraftsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
