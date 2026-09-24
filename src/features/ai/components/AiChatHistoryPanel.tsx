import * as stylex from '@stylexjs/stylex';
import { History, MessageSquarePlus, Trash2, X } from 'lucide-react';
import type { AiThread } from '../../../domain/ai/models/ai.types';
import { Button } from '../../../shared/ui/Button/Button';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import { IconButton } from '../../../shared/ui/IconButton/IconButton';
import { formatSessionTime } from '../utils/formatSessionTime';

const styles = stylex.create({
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid var(--color-border)',
  },
  heading: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    color: 'var(--color-text-secondary)',
  },
  headingIcon: {
    width: 15,
    height: 15,
    color: 'var(--color-accent)',
  },
  newChatRow: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--color-border)',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    margin: 0,
    padding: '8px 8px 12px 8px',
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    WebkitOverflowScrolling: 'touch',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 8px 6px 10px',
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'transparent',
  },
  rowActive: {
    backgroundColor: 'var(--color-overlay-hover)',
    borderColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)',
  },
  sessionButton: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    padding: 0,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'transparent',
    font: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    borderRadius: 6,
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  sessionTitle: {
    width: '100%',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sessionMeta: {
    fontSize: 11,
    color: 'var(--color-text-secondary)',
  },
  footer: {
    padding: '10px 16px',
    borderTop: '1px solid var(--color-border)',
  },
});

export interface AiChatHistoryPanelProps {
  sessions: AiThread[];
  /** Session currently open in the transcript, if any. */
  activeThreadId: string | null;
  isStreaming: boolean;
  onSelectSession: (threadId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (threadId: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

/**
 * Session history for the AI drawer: every conversation held in the current
 * scope, newest first. Selecting one reopens it; starting a new one leaves the
 * existing conversations untouched.
 */
export function AiChatHistoryPanel({
  sessions,
  activeThreadId,
  isStreaming,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onClearAll,
  onClose,
}: AiChatHistoryPanelProps) {
  return (
    <div
      {...stylex.props(styles.container)}
      role="region"
      aria-label="Conversation history"
    >
      <div {...stylex.props(styles.header)}>
        <h3 {...stylex.props(styles.heading)}>
          <History {...stylex.props(styles.headingIcon)} aria-hidden="true" />
          Conversations
        </h3>
        <IconButton
          label="Close conversation history"
          icon={<X size={16} />}
          variant="ghost"
          size="sm"
          onClick={onClose}
        />
      </div>

      <div {...stylex.props(styles.newChatRow)}>
        <Button
          label="Start a new conversation"
          variant="primary"
          icon={<MessageSquarePlus size={15} />}
          isDisabled={isStreaming}
          onClick={onNewSession}
          style={{ width: '100%' }}
        >
          New chat
        </Button>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          size="compact"
          icon={<MessageSquarePlus size={28} />}
          title="No conversations yet"
          description="Ask something to start one."
          headingLevel="h4"
          style={{ flex: 1 }}
        />
      ) : (
        <ul {...stylex.props(styles.list)}>
          {sessions.map((session) => {
            const isActive = session.id === activeThreadId;
            return (
              <li
                key={session.id}
                {...stylex.props(styles.row, isActive && styles.rowActive)}
              >
                <button
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  aria-current={isActive ? 'true' : undefined}
                  {...stylex.props(styles.sessionButton)}
                >
                  <span {...stylex.props(styles.sessionTitle)}>{session.title}</span>
                  <span {...stylex.props(styles.sessionMeta)}>
                    {formatSessionTime(session.updatedAt)}
                  </span>
                </button>
                <IconButton
                  label={`Delete conversation: ${session.title}`}
                  icon={<Trash2 size={14} />}
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteSession(session.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {sessions.length > 0 && (
        <div {...stylex.props(styles.footer)}>
          <Button
            label="Delete every conversation for this material"
            variant="danger"
            isDisabled={isStreaming}
            onClick={onClearAll}
            style={{ width: '100%' }}
          >
            Clear all conversations
          </Button>
        </div>
      )}
    </div>
  );
}
