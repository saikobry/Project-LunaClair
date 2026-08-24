import { useState, useEffect, useCallback, useRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import { X, Trash2, Sparkles } from 'lucide-react';
import { useAiChatThread } from '../hooks/useAiChatThread';
import { AiModeSelector } from './AiModeSelector';
import { AiChatMessageList } from './AiChatMessageList';
import { AiChatInput } from './AiChatInput';

const mobile = '@media (max-width: 768px)';

const styles = stylex.create({
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 90,
    display: 'none',
    [mobile]: {
      display: 'block',
    },
  },
  drawerContainer: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 400,
    maxWidth: '100vw',
    backgroundColor: 'var(--color-surface, #ffffff)',
    borderLeft: '1px solid var(--color-border, #e5e7eb)',
    boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    [mobile]: {
      top: 'auto',
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '82vh',
      borderLeft: 'none',
      borderTop: '1px solid var(--color-border, #e5e7eb)',
      borderTopLeftRadius: '16px',
      borderTopRightRadius: '16px',
      boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.15)',
    },
  },
  drawerClosed: {
    transform: 'translateX(100%)',
    pointerEvents: 'none',
    [mobile]: {
      transform: 'translateY(100%)',
    },
  },
  drawerOpen: {
    transform: 'translateX(0)',
    pointerEvents: 'auto',
    [mobile]: {
      transform: 'translateY(0)',
    },
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '14px 16px',
    borderBottom: '1px solid var(--color-border, #e5e7eb)',
    backgroundColor: 'var(--color-surface, #ffffff)',
    borderTopLeftRadius: 'inherit',
    borderTopRightRadius: 'inherit',
  },
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    width: 18,
    height: 18,
    color: 'var(--color-primary, #6366f1)',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--color-text-primary, #111827)',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    color: 'var(--color-text-secondary, #6b7280)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    ':hover': {
      backgroundColor: 'var(--color-surface-hover, rgba(0, 0, 0, 0.05))',
      color: 'var(--color-text-primary, #111827)',
    },
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
});

export interface SelectionContext {
  text: string;
  action?: 'explain' | 'simplify' | 'example';
  sectionHeading?: string;
}

export interface AiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  materialId?: string;
  documentContext?: string;
  selectionContext?: SelectionContext | null;
  onClearSelectionContext?: () => void;
}

export function AiChatDrawer({
  isOpen,
  onClose,
  materialId,
  documentContext,
  selectionContext,
  onClearSelectionContext,
}: AiChatDrawerProps) {
  const [mode, setMode] = useState<'assistant' | 'socratic'>('assistant');

  // Active chat thread for the current mode
  const {
    messages,
    isLoading,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearHistory,
    retryMessage,
  } = useAiChatThread({
    materialId,
    mode,
  });

  // Handle incoming selection contextual actions (e.g. from Reader toolbar)
  const handledSelectionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectionContext || !isOpen) return;

    const selectionKey = `${selectionContext.action}:${selectionContext.text}`;
    if (handledSelectionRef.current === selectionKey) return;
    handledSelectionRef.current = selectionKey;

    if (selectionContext.action) {
      let prompt = '';
      if (selectionContext.action === 'explain') {
        prompt = `Please explain the following excerpt in clear detail:\n\n> "${selectionContext.text}"`;
      } else if (selectionContext.action === 'simplify') {
        prompt = `Please simplify this concept into plain, intuitive terms that are easy to remember:\n\n> "${selectionContext.text}"`;
      } else if (selectionContext.action === 'example') {
        prompt = `Please provide a clear, real-world example illustrating this concept:\n\n> "${selectionContext.text}"`;
      }

      if (prompt) {
        sendMessage(prompt, {
          documentContext: documentContext
            ? { id: materialId || 'current-doc', markdown: documentContext }
            : undefined,
          selection: {
            text: selectionContext.text,
            surroundingHeading: selectionContext.sectionHeading,
          },
        });
        onClearSelectionContext?.();
      }
    }
  }, [selectionContext, isOpen, sendMessage, documentContext, materialId, onClearSelectionContext]);

  const handleSendPrompt = useCallback(
    (promptText: string) => {
      sendMessage(promptText, {
        documentContext: documentContext
          ? { id: materialId || 'current-doc', markdown: documentContext }
          : undefined,
        selection: selectionContext
          ? {
              text: selectionContext.text,
              surroundingHeading: selectionContext.sectionHeading,
            }
          : undefined,
      });
      if (selectionContext) {
        onClearSelectionContext?.();
      }
    },
    [sendMessage, documentContext, materialId, selectionContext, onClearSelectionContext],
  );

  const handleClearHistory = useCallback(async () => {
    if (messages.length === 0) return;
    const confirmed = window.confirm('Are you sure you want to clear this conversation history?');
    if (confirmed) {
      await clearHistory();
    }
  }, [messages.length, clearHistory]);

  return (
    <>
      {isOpen && (
        <div
          {...stylex.props(styles.backdrop)}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        {...stylex.props(
          styles.drawerContainer,
          isOpen ? styles.drawerOpen : styles.drawerClosed,
        )}
        aria-label="AI Study Assistant"
        aria-hidden={!isOpen}
      >
        <div {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.headerTopRow)}>
            <div {...stylex.props(styles.titleGroup)}>
              <Sparkles {...stylex.props(styles.titleIcon)} aria-hidden="true" />
              <h2 {...stylex.props(styles.title)}>AI Study Assistant</h2>
            </div>
            <div {...stylex.props(styles.headerActions)}>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  title="Clear chat history"
                  aria-label="Clear chat history"
                  {...stylex.props(styles.iconBtn)}
                >
                  <Trash2 style={{ width: 15, height: 15 }} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                title="Close AI Assistant"
                aria-label="Close AI Assistant"
                {...stylex.props(styles.iconBtn)}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
          </div>

          <AiModeSelector
            currentMode={mode}
            onModeChange={setMode}
            assistantMessageCount={mode === 'assistant' ? messages.length : undefined}
            socraticMessageCount={mode === 'socratic' ? messages.length : undefined}
            disabled={isStreaming}
          />
        </div>

        <div {...stylex.props(styles.body)}>
          <AiChatMessageList
            messages={messages}
            isLoading={isLoading}
            isStreaming={isStreaming}
            onSendMessage={handleSendPrompt}
            onRetryMessage={retryMessage}
            mode={mode}
          />

          <AiChatInput
            onSendMessage={handleSendPrompt}
            onStopGeneration={stopStreaming}
            isStreaming={isStreaming}
            disabled={isLoading}
            selectionExcerpt={selectionContext?.text}
            onClearSelection={onClearSelectionContext}
          />
        </div>
      </aside>
    </>
  );
}
