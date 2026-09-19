import { memo } from 'react';
import * as stylex from '@stylexjs/stylex';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import type { Components } from 'react-markdown';
import { Bot, User, AlertCircle, RotateCcw } from 'lucide-react';
import type { AiMessageRecord } from '../../../domain/ai/models/ai.types';
import { aiSanitizeSchema } from '../utils/aiMarkdown';
import { Button } from '../../../shared/ui/Button/Button';
import { AiMessageUsage } from './AiMessageUsage';
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
    backgroundColor: 'var(--color-neutral)',
    color: 'var(--color-text-secondary)',
  },
  assistantAvatar: {
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
    color: 'var(--color-accent)',
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
    backgroundColor: 'var(--color-accent)',
    color: 'var(--color-on-accent)',
    borderBottomRightRadius: '3px',
  },
  assistantBubble: {
    backgroundColor: 'var(--color-background-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderBottomLeftRadius: '3px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
  },
  h1: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: '12px 0 6px 0',
  },
  h2: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: '10px 0 6px 0',
  },
  h3: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
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
    backgroundColor: 'var(--color-neutral)',
    color: 'var(--color-accent)',
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
    borderLeft: '3px solid var(--color-accent)',
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    margin: '8px 0',
    fontSize: '13px',
  },
  th: {
    border: '1px solid var(--color-border)',
    padding: '6px 10px',
    textAlign: 'left',
    backgroundColor: 'var(--color-background-muted)',
    fontWeight: 600,
  },
  td: {
    border: '1px solid var(--color-border)',
    padding: '6px 10px',
    textAlign: 'left',
  },
  errorBanner: {
    marginTop: 8,
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: 'var(--color-error-muted)',
    border: '1px solid color-mix(in srgb, var(--color-error) 20%, transparent)',
    color: 'var(--color-error)',
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
  interruptedBadge: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'color-mix(in srgb, var(--color-error) 15%, transparent)',
    color: 'var(--color-error)',
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
  /** Overrides the wait label shown while a turn is still streaming. */
  streamingLabel?: string;
}

export const AiChatMessage = memo(function AiChatMessage({
  message,
  onRetry,
  streamingLabel,
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

        <AiMessageUsage message={message} />

        {isStreaming && (
          <div style={{ marginTop: 6 }}>
            <AiStreamingIndicator label={streamingLabel ?? 'Generating response…'} />
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
              <Button
                label="Retry generating response"
                variant="danger"
                icon={<RotateCcw size={12} />}
                onClick={() => onRetry(message.id)}
                style={{ minHeight: 28, padding: '4px 10px', fontSize: 12 }}
              >
                Retry
              </Button>
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
