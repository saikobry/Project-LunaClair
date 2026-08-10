import type { ChangeEvent } from 'react';
import { TextArea as AstryxTextArea } from '@astryxdesign/core/TextArea';

export interface TextAreaProps {
  /** Label text for the textarea. */
  label: string;
  /** Current value. */
  value: string;
  /** Change handler. */
  onChange?: (value: string, e: ChangeEvent<HTMLTextAreaElement>) => void;
  /** Placeholder text. */
  placeholder?: string;
  /** Disabled state. @default false */
  disabled?: boolean;
  /** Whether the field is required. @default false */
  required?: boolean;
  /** Visible rows. @default 3 */
  rows?: number;
  /** Whether to visually hide the label. @default false */
  labelHidden?: boolean;
  /** Error or status message. */
  statusMessage?: string;
  /** Input size. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class name. */
  className?: string;
  /** Inline styles. */
  style?: React.CSSProperties;
}

/**
 * LunaClair TextArea — thin adapter over @astryxdesign/core TextArea.
 *
 * Provides a themed multi-line text input with label, validation state,
 * and accessibility built-in.
 */
export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  rows = 3,
  labelHidden = false,
  statusMessage,
  size = 'md',
  className,
  style,
}: TextAreaProps) {
  return (
    <AstryxTextArea
      label={label}
      isLabelHidden={labelHidden}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isDisabled={disabled}
      isRequired={required}
      rows={rows}
      size={size}
      className={className}
      style={style}
      {...(statusMessage
        ? { status: { type: 'error' as const, message: statusMessage } }
        : undefined)}
    />
  );
}

TextArea.displayName = 'TextArea';
