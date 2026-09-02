import { memo } from 'react';
import * as stylex from '@stylexjs/stylex';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import type { Components } from 'react-markdown';
import { Bot, User, AlertCircle, RotateCcw } from 'lucide-react';
import type { AiMessageRecord } from '../../../domain/ai/models/ai.types';
import { aiSanitizeSchema } from '../lib/aiMarkdown';
import { AiStreamingIndicator } from './AiStreamingIndicator';

const styles = stylex.create({
  messageRow: {
    display: 'flex',
    gap: 10,
    width: '100%',
    boxSizing: 'border-box',
    marginBottom: 16,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  userAvatar: {
    backgroundColor: 'var(--color-surface-hover, rgba(0, 0, 0, 0.06))',
    color: 'var(--color-text-secondary, #6b7280)',
  },
  assistantAvatar: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    color: 'var(--color-primary, #6366f1)',
  },
  avatarIcon: {
    width: 16,
    height: 16,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: '14px',
    padding: '10px 14px',
    fontSize: '14px',
    lineHeight: 1.55,
    wordBreak: 'break-word',
    boxSizing: 'border-box',
  },
  userBubble: {
    backgroundColor: 'var(--color-primary, #6366f1)',
    color: '#ffffff',
    borderBottomRightRadius: '3px',
  },
  assistantBubble: {
    backgroundColor: 'var(--color-surface, #ffffff)',
    color: 'var(--color-text-primary, #111827)',
    border: '1px solid var(--color-border, #e5e7eb)',
    borderBottomLeftRadius: '3px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
  },
  h1: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--color-text-primary, #111827)',
    margin: '12px 0 6px 0',
  },
  h2: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--color-text-primary, #111827)',
    margin: '10px 0 6px 0',
  },
  h3: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--color-text-primary, #111827)',
    margin: '8px 0 4px 0',
  },
  paragraph: {
    margin: '0 0 8px 0',
  },
  list: {
    margin: '4px 0 8px 0',
    paddingLeft: 20,
  },
  listItem: {
    marginBottom: 3,
  },
  inlineCode: {
    fontFamily: 'monospace',
    fontSize: '12px',
    padding: '2px 5px',
    borderRadius: '4px',
    backgroundColor: 'var(--color-surface-hover, rgba(0, 0, 0, 0.05))',
    color: 'var(--color-primary, #6366f1)',
  },
  pre: {
    margin: '8px 0',
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    overflowX: 'auto',
    fontSize: '12px',
  },
  blockquote: {
    margin: '8px 0',
    paddingLeft: 10,
    borderLeft: '3px solid var(--color-primary, #6366f1)',
    color: 'var(--color-text-secondary, #6b7280)',
    fontStyle: 'italic',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    margin: '8px 0',
    fontSize: '13px',
  },
  th: {
    border: '1px solid var(--color-border, #e5e7eb)',
    padding: '6px 10px',
    textAlign: 'left',
    backgroundColor: 'var(--color-surface-hover, rgba(0, 0, 0, 0.04))',
    fontWeight: 600,
  },
  td: {
    border: '1px solid var(--color-border, #e5e7eb)',
    padding: '6px 10px',
    textAlign: 'left',
  },
  errorBanner: {
    marginTop: 8,
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: 'var(--color-danger, #ef4444)',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  errorContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  retryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    border: 'none',
    borderRadius: '6px',
    backgroundColor: 'var(--color-danger, #ef4444)',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 500,
    padding: '4px 8px',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: '#dc2626',
    },
  },
  interruptedBadge: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--color-danger, #ef4444)',
    marginBottom: 6,
    display: 'inline-block',
  },
});

const markdownComponents: Components = {
  h1: ({ children }) => <h1 {...stylex.props(styles.h1)}>{children}</h1>,
  h2: ({ children }) => <h2 {...stylex.props(styles.h2)}>{children}</h2>,
  h3: ({ children }) => <h3 {...stylex.props(styles.h3)}>{children}</h3>,
  p: ({ children }) => <p {...stylex.props(styles.paragraph)}>{children}</p>,
  ul: ({ children }) => <ul {...stylex.props(styles.list)}>{children}</ul>,
  ol: ({ children }) => <ol {...stylex.props(styles.list)}>{children}</ol>,
  li: ({ children }) => <li {...stylex.props(styles.listItem)}>{children}</li>,
  blockquote: ({ children }) => <blockquote {...stylex.props(styles.blockquote)}>{children}</blockquote>,
  code: ({ children, className }) => {
    const isBlock = Boolean(className);
    return isBlock ? (
      <code className={className}>{children}</code>
    ) : (
      <code {...stylex.props(styles.inlineCode)}>{children}</code>
    );
  },
  pre: ({ children }) => <pre {...stylex.props(styles.pre)}>{children}</pre>,
  table: ({ children }) => <table {...stylex.props(styles.table)}>{children}</table>,
  th: ({ children }) => <th {...stylex.props(styles.th)}>{children}</th>,
  td: ({ children }) => <td {...stylex.props(styles.td)}>{children}</td>,
};

export interface AiChatMessageProps {
  message: AiMessageRecord;
  onRetry?: (messageId: string) => void;
}

export const AiChatMessage = memo(function AiChatMessage({
  message,
  onRetry,
}: AiChatMessageProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';
  const isInterrupted = message.metadata?.errorCode === 'INTERRUPTED';

  return (
    <div
      {...stylex.props(
        styles.messageRow,
        isUser ? styles.userRow : styles.assistantRow,
      )}
      data-testid={`ai-message-${message.id}`}
    >
      {!isUser && (
        <div {...stylex.props(styles.avatar, styles.assistantAvatar)} aria-hidden="true">
          <Bot {...stylex.props(styles.avatarIcon)} />
        </div>
      )}

      <div
        {...stylex.props(
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        )}
      >
        {isInterrupted && (
          <span {...stylex.props(styles.interruptedBadge)}>Interrupted</span>
        )}

        {isUser ? (
          <div>{message.content}</div>
        ) : (
          <div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, [rehypeSanitize, aiSanitizeSchema]]}
              components={markdownComponents}
            >
              {message.content || (isStreaming ? '' : '…')}
            </ReactMarkdown>
          </div>
        )}

        {isStreaming && (
          <div style={{ marginTop: 6 }}>
            <AiStreamingIndicator label="Generating response…" />
          </div>
        )}

        {isError && (
          <div {...stylex.props(styles.errorBanner)}>
            <div {...stylex.props(styles.errorContent)}>
              <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
              <span>
                {message.metadata?.errorMessage ||
                  (isInterrupted
                    ? 'Generation was interrupted.'
                    : 'Failed to generate response.')}
              </span>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                {...stylex.props(styles.retryButton)}
                aria-label="Retry generating response"
              >
                <RotateCcw style={{ width: 12, height: 12 }} />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div {...stylex.props(styles.avatar, styles.userAvatar)} aria-hidden="true">
          <User {...stylex.props(styles.avatarIcon)} />
        </div>
      )}
    </div>
  );
});
