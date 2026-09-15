import {
  useState,
  useRef,
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
  type FormEvent,
} from 'react';
import * as stylex from '@stylexjs/stylex';
import { Send, Square, Quote, X } from 'lucide-react';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 16px',
    backgroundColor: 'var(--color-surface, #ffffff)',
    borderTop: '1px solid var(--color-border)',
  },
  selectionBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '6px 10px',
    borderRadius: '6px',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    border: '1px solid rgba(99, 102, 241, 0.18)',
    fontSize: '12px',
    color: 'var(--color-accent)',
  },
  selectionContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  selectionIcon: {
    width: 13,
    height: 13,
    flexShrink: 0,
  },
  selectionText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontStyle: 'italic',
  },
  clearSelectionBtn: {
    border: 'none',
    background: 'none',
    padding: 2,
    cursor: 'pointer',
    color: 'var(--color-accent)',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    ':hover': {
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
    },
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: 'var(--color-surface-hover, rgba(0, 0, 0, 0.04))',
    border: '1px solid var(--color-border)',
    borderRadius: '12px',
    padding: '6px 8px 6px 12px',
    transition: 'border-color 0.15s ease',
    ':focus-within': {
      borderColor: 'var(--color-accent)',
      backgroundColor: 'var(--color-surface, #ffffff)',
      boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.12)',
    },
  },
  textarea: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    padding: '4px 0',
    margin: 0,
    fontSize: '14px',
    lineHeight: 1.45,
    color: 'var(--color-text-primary, #111827)',
    resize: 'none',
    outline: 'none',
    maxHeight: 140,
    minHeight: 24,
    fontFamily: 'inherit',
    '::placeholder': {
      color: 'var(--color-text-tertiary, #9ca3af)',
    },
  },
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },
  sendButton: {
    backgroundColor: 'var(--color-accent)',
    color: '#ffffff',
    ':hover': {
      backgroundColor: 'color-mix(in srgb, var(--color-accent) 85%, black)',
    },
    ':disabled': {
      opacity: 0.4,
      cursor: 'not-allowed',
      backgroundColor: 'var(--color-text-tertiary, #9ca3af)',
    },
  },
  stopButton: {
    backgroundColor: 'var(--color-error)',
    color: '#ffffff',
    ':hover': {
      backgroundColor: '#dc2626',
    },
  },
  buttonIcon: {
    width: 15,
    height: 15,
  },
});

export interface AiChatInputProps {
  onSendMessage: (content: string) => void;
  onStopGeneration?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  selectionExcerpt?: string;
  onClearSelection?: () => void;
}

export function AiChatInput({
  onSendMessage,
  onStopGeneration,
  isStreaming = false,
  disabled = false,
  placeholder = 'Ask a question about this material…',
  selectionExcerpt,
  onClearSelection,
}: AiChatInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height as user types
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [content]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSendMessage(trimmed);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Crucial: do NOT send when IME composition (e.g. Japanese, Chinese, Pinyin) is active
    const isImeComposing =
      Boolean((e as unknown as { isComposing?: boolean }).isComposing) ||
      Boolean(e.nativeEvent?.isComposing) ||
      e.keyCode === 229;

    if (isImeComposing) {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isStreaming) {
      onStopGeneration?.();
    } else {
      handleSend();
    }
  };

  return (
    <form {...stylex.props(styles.container)} onSubmit={handleSubmit}>
      {selectionExcerpt && (
        <div {...stylex.props(styles.selectionBanner)}>
          <div {...stylex.props(styles.selectionContent)}>
            <Quote {...stylex.props(styles.selectionIcon)} aria-hidden="true" />
            <span {...stylex.props(styles.selectionText)}>
              Context: &ldquo;{selectionExcerpt}&rdquo;
            </span>
          </div>
          {onClearSelection && (
            <button
              type="button"
              onClick={onClearSelection}
              aria-label="Clear selected text context"
              {...stylex.props(styles.clearSelectionBtn)}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      )}

      <div {...stylex.props(styles.inputRow)}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          rows={1}
          aria-label="Ask the AI Study Assistant"
          {...stylex.props(styles.textarea)}
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onStopGeneration}
            aria-label="Stop generating response"
            title="Stop generation"
            {...stylex.props(styles.actionButton, styles.stopButton)}
          >
            <Square {...stylex.props(styles.buttonIcon)} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!content.trim() || disabled}
            aria-label="Send message"
            title="Send message"
            {...stylex.props(styles.actionButton, styles.sendButton)}
          >
            <Send {...stylex.props(styles.buttonIcon)} aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );
}
