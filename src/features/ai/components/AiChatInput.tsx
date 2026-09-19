import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { Quote, X } from 'lucide-react';
import { ChatComposer } from '../../../shared/ui/ChatComposer/ChatComposer';
import { IconButton } from '../../../shared/ui/IconButton/IconButton';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 16px',
    backgroundColor: 'var(--color-background-surface)',
    borderTop: '1px solid var(--color-border)',
  },
  selectionBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '6px 10px',
    borderRadius: '6px',
    backgroundColor: 'var(--color-overlay-hover)',
    border: '1px solid color-mix(in srgb, var(--color-accent) 18%, transparent)',
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
});

export interface AiChatInputProps {
  onSendMessage: (content: string) => void;
  onStopGeneration?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  /**
   * Blocks submission while leaving the field editable — for guards the user can resolve
   * (a conversation too large for the selected model, a rate-limit cooldown). The reason is
   * rendered beside the model control, so this only has to prevent the request.
   */
  isSendBlocked?: boolean;
  placeholder?: string;
  selectionExcerpt?: string;
  onClearSelection?: () => void;
}

export function AiChatInput({
  onSendMessage,
  onStopGeneration,
  isStreaming = false,
  disabled = false,
  isSendBlocked = false,
  placeholder = 'Ask a question about this material…',
  selectionExcerpt,
  onClearSelection,
}: AiChatInputProps) {
  const [content, setContent] = useState('');

  const handleSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled || isSendBlocked) return;
    onSendMessage(trimmed);
  };

  return (
    <div {...stylex.props(styles.container)}>
      <ChatComposer
        label="Ask the AI Study Assistant"
        value={content}
        onChange={setContent}
        onSubmit={handleSubmit}
        onStop={onStopGeneration}
        isStopShown={isStreaming}
        placeholder={placeholder}
        isDisabled={disabled || isStreaming}
        maxRows={6}
        drawer={
          selectionExcerpt ? (
            <div {...stylex.props(styles.selectionBanner)}>
              <div {...stylex.props(styles.selectionContent)}>
                <Quote {...stylex.props(styles.selectionIcon)} aria-hidden="true" />
                <span {...stylex.props(styles.selectionText)}>
                  Context: &ldquo;{selectionExcerpt}&rdquo;
                </span>
              </div>
              {onClearSelection && (
                <IconButton
                  label="Clear selected text context"
                  icon={<X size={14} />}
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                />
              )}
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
