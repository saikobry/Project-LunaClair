import { memo } from 'react';
import * as stylex from '@stylexjs/stylex';
import { History, X, Sparkles } from 'lucide-react';
import { IconButton } from '../../../shared/ui/IconButton/IconButton';

const styles = stylex.create({
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 20,
    borderBottom: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    borderTopLeftRadius: 'inherit',
    borderTopRightRadius: 'inherit',
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    width: 18,
    height: 18,
    color: 'var(--color-accent)',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
    margin: '4px 0 0 0',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  historyButtonWrap: {
    position: 'relative',
    display: 'inline-flex',
  },
  historyCount: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    borderRadius: 8,
    backgroundColor: 'var(--color-accent)',
    color: 'var(--color-on-accent)',
    fontSize: 10,
    fontWeight: 700,
    lineHeight: '16px',
    textAlign: 'center',
    pointerEvents: 'none',
  },
});

export interface AiChatDrawerHeaderProps {
  /** Active conversation's title, or the assistant's own name before one exists. */
  title: string;
  /** Sessions in scope, badged onto the history button. */
  sessionCount: number;
  isHistoryOpen: boolean;
  onToggleHistory: () => void;
  onClose: () => void;
}

/**
 * Title, session-history toggle, and close control for the AI drawer.
 *
 * The badge is an affordance rather than a count to act on — it exists so an empty history is
 * distinguishable from a populated one without opening the panel.
 */
export const AiChatDrawerHeader = memo(function AiChatDrawerHeader({
  title,
  sessionCount,
  isHistoryOpen,
  onToggleHistory,
  onClose,
}: AiChatDrawerHeaderProps) {
  return (
    <div {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.headerTopRow)}>
        <div>
          <div {...stylex.props(styles.titleGroup)}>
            <Sparkles {...stylex.props(styles.titleIcon)} aria-hidden="true" />
            <h2 {...stylex.props(styles.title)}>{title}</h2>
          </div>
          <p {...stylex.props(styles.subtitle)}>Study help, grounded in your material.</p>
        </div>
        <div {...stylex.props(styles.headerActions)}>
          <span {...stylex.props(styles.historyButtonWrap)}>
            <IconButton
              label="Conversation history"
              icon={<History size={16} />}
              variant="ghost"
              size="sm"
              aria-expanded={isHistoryOpen}
              onClick={onToggleHistory}
            />
            {sessionCount > 0 && (
              <span {...stylex.props(styles.historyCount)} aria-hidden="true">
                {sessionCount}
              </span>
            )}
          </span>
          <IconButton
            label="Close AI Assistant"
            icon={<X size={18} />}
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </div>
      </div>
    </div>
  );
});
