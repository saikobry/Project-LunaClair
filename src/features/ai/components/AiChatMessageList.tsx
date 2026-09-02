import { useRef, useEffect } from 'react';
import * as stylex from '@stylexjs/stylex';
import { ArrowDown, Bot, Sparkles, HelpCircle, BookOpen, Lightbulb } from 'lucide-react';
import type { AiMessageRecord } from '../../../domain/ai/models/ai.types';
import { AiChatMessage } from './AiChatMessage';
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
    color: 'var(--color-text-secondary, #6b7280)',
  },
  emptyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: '12px',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    color: 'var(--color-primary, #6366f1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--color-text-primary, #111827)',
    margin: '0 0 6px 0',
  },
  emptySubtitle: {
    fontSize: '13px',
    color: 'var(--color-text-secondary, #6b7280)',
    margin: '0 0 20px 0',
    maxWidth: 280,
    lineHeight: 1.4,
  },
  starterGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
    maxWidth: 320,
  },
  starterButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--color-border, #e5e7eb)',
    backgroundColor: 'var(--color-surface, #ffffff)',
    color: 'var(--color-text-primary, #111827)',
    fontSize: '13px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    ':hover': {
      borderColor: 'var(--color-primary, #6366f1)',
      backgroundColor: 'rgba(99, 102, 241, 0.04)',
      transform: 'translateY(-1px)',
    },
  },
  starterIcon: {
    width: 16,
    height: 16,
    color: 'var(--color-primary, #6366f1)',
    flexShrink: 0,
  },
  scrollToBottomBtn: {
    position: 'sticky',
    bottom: 12,
    alignSelf: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: '20px',
    backgroundColor: 'var(--color-primary, #6366f1)',
    color: '#ffffff',
    border: 'none',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    zIndex: 10,
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-primary-hover, #4f46e5)',
      transform: 'scale(1.03)',
    },
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
                    <Icon {...stylex.props(styles.starterIcon)} aria-hidden="true" />
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
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          {...stylex.props(styles.scrollToBottomBtn)}
          aria-label="Scroll to latest messages"
        >
          <ArrowDown style={{ width: 13, height: 13 }} />
          <span>Latest messages</span>
        </button>
      )}
    </div>
  );
}
