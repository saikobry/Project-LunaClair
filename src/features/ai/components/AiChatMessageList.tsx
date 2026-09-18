import { useRef, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ArrowDown, Bot, Sparkles, HelpCircle, BookOpen, Lightbulb } from 'lucide-react';
import type { AiMessageRecord } from '../../../domain/ai/models/ai.types';
import { AiChatMessage } from './AiChatMessage';
import { Button } from '../../../shared/ui/Button/Button';
import { useAiAutoScroll } from '../hooks/useAiAutoScroll';

const styles = stylex.create({
  container: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    WebkitOverflowScrolling: 'touch',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 'auto 0',
    padding: '24px 16px',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
  },
  emptyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: '12px',
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
    color: 'var(--color-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: '0 0 6px 0',
  },
  emptySubtitle: {
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
    margin: '0 0 20px 0',
    maxWidth: 280,
    lineHeight: 1.4,
  },
  starterGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: '100%',
    maxWidth: 320,
  },
  // Replicates the collection playlist row card: bordered surface (radius
  // 12), icon tile, title row. Hover carries the row's accent-border +
  // muted-wash treatment so the prompts read as the same component family.
  starterButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    color: 'var(--color-text-primary)',
    fontSize: 14,
    fontWeight: 500,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'border-color 0.16s ease, background-color 0.16s ease',
    ':hover': {
      borderColor: 'var(--color-accent)',
      backgroundColor: 'var(--color-background-muted)',
    },
    ':focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '2px',
    },
  },
  starterIconMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'var(--color-overlay-hover)',
    color: 'var(--color-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scrollToBottomWrap: {
    position: 'sticky',
    bottom: 12,
    alignSelf: 'center',
    zIndex: 10,
  },
});

export interface AiChatMessageListProps {
  messages: AiMessageRecord[];
  isLoading?: boolean;
  isStreaming?: boolean;
  onSendMessage?: (prompt: string) => void;
  onRetryMessage?: (messageId: string) => void;
  mode?: 'assistant' | 'socratic';
}

const STARTER_PROMPTS = [
  {
    icon: Sparkles,
    label: 'Summarize the core concepts',
    prompt: 'Can you summarize the core concepts of this study material into concise bullet points?',
  },
  {
    icon: HelpCircle,
    label: 'Generate practice questions',
    prompt: 'Please generate 3 conceptual practice questions with explanations based on this material.',
  },
  {
    icon: Lightbulb,
    label: 'Explain difficult topics simply',
    prompt: 'What are the most challenging topics in this material, and how can I understand them simply?',
  },
];

export function AiChatMessageList({
  messages,
  isLoading = false,
  isStreaming = false,
  onSendMessage,
  onRetryMessage,
  mode = 'assistant',
}: AiChatMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isNearBottom, scrollToBottom, notifyContentUpdated } = useAiAutoScroll(containerRef, {
    isStreaming,
  });

  // Whenever messages change or stream updates, trigger auto-scroll if near bottom
  useEffect(() => {
    notifyContentUpdated();
  }, [messages, notifyContentUpdated]);

  return (
    <div
      ref={containerRef}
      {...stylex.props(styles.container)}
      role="log"
      aria-label="AI conversation history"
      aria-live="polite"
    >
      {messages.length === 0 && !isLoading && (
        <div {...stylex.props(styles.emptyState)}>
          <div {...stylex.props(styles.emptyIconContainer)}>
            {mode === 'socratic' ? (
              <BookOpen style={{ width: 24, height: 24 }} />
            ) : (
              <Bot style={{ width: 24, height: 24 }} />
            )}
          </div>
          <h3 {...stylex.props(styles.emptyTitle)}>
            {mode === 'socratic' ? 'Socratic Tutor' : 'AI Study Assistant'}
          </h3>
          <p {...stylex.props(styles.emptySubtitle)}>
            {mode === 'socratic'
              ? 'I will guide you step-by-step through questions to strengthen your understanding.'
              : 'Ask anything about your study notes, request summaries, or clarify difficult concepts.'}
          </p>

          {onSendMessage && (
            <div {...stylex.props(styles.starterGrid)}>
              {STARTER_PROMPTS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onSendMessage(item.prompt)}
                    {...stylex.props(styles.starterButton)}
                  >
                    <span {...stylex.props(styles.starterIconMark)} aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {messages.map((message) => (
        <AiChatMessage
          key={message.id}
          message={message}
          onRetry={onRetryMessage}
        />
      ))}

      {!isNearBottom && (
        <div {...stylex.props(styles.scrollToBottomWrap)}>
          <Button
            label="Scroll to latest messages"
            variant="primary"
            icon={<ArrowDown size={13} />}
            onClick={() => scrollToBottom(true)}
          >
            Latest messages
          </Button>
        </div>
      )}
    </div>
  );
}
