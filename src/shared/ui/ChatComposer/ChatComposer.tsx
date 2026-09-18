import type { CSSProperties, ReactNode } from 'react';
import {
  ChatComposer as AstryxChatComposer,
  ChatComposerInput,
} from '@astryxdesign/core/Chat';
import type { ChatComposerDensity } from '@astryxdesign/core/Chat';

export interface ChatComposerProps {
  /** Screen-reader name for the message field. */
  label: string;
  /** Controlled input value. */
  value: string;
  /** Change handler. */
  onChange: (value: string) => void;
  /** Submit handler — receives the trimmed message (never empty). */
  onSubmit: (value: string) => void;
  /** Stop handler — shown instead of send while `isStopShown`. */
  onStop?: () => void;
  /** Whether the stop button replaces the send button. @default false */
  isStopShown?: boolean;
  /** Placeholder text. */
  placeholder?: string;
  /** Disabled state. @default false */
  isDisabled?: boolean;
  /** Density variant. @default 'balanced' */
  density?: ChatComposerDensity;
  /** Resting elevation. @default 'none' (flat, text-input border treatment) */
  elevation?: 'none' | 'low';
  /** Max visible rows before scrolling. @default 8 */
  maxRows?: number;
  /** Contextual content rendered above the input (e.g. selection banner). */
  drawer?: ReactNode;
  /** Additional class name. */
  className?: string;
  /** Inline styles. */
  style?: CSSProperties;
}

/**
 * LunaClair ChatComposer — thin adapter over @astryxdesign/core ChatComposer.
 *
 * The standard grounded-chat input: IME-guarded Enter-to-submit, message
 * history, auto-growing contentEditable field, and a send/stop toggle button
 * come through transparently. Long pastes stay plain text (`pasteAsToken`
 * off) — token chips are opt-in per consumer.
 */
export function ChatComposer({
  label,
  value,
  onChange,
  onSubmit,
  onStop,
  isStopShown = false,
  placeholder,
  isDisabled = false,
  density = 'balanced',
  elevation = 'none',
  maxRows = 8,
  drawer,
  className,
  style,
}: ChatComposerProps) {
  return (
    <AstryxChatComposer
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      onStop={onStop}
      isStopShown={isStopShown}
      placeholder={placeholder}
      isDisabled={isDisabled}
      density={density}
      elevation={elevation}
      drawer={drawer}
      className={className}
      style={style}
      input={
        <ChatComposerInput
          label={label}
          maxRows={maxRows}
          pasteAsToken={false}
        />
      }
    />
  );
}

ChatComposer.displayName = 'ChatComposer';
