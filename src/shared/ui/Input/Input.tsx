import { type ChangeEvent, type ReactNode } from 'react';
import { TextInput } from '@astryxdesign/core/TextInput';

export interface InputProps {
  /** Label text for the input. */
  label: string;
  /** Current value. */
  value: string;
  /** Change handler. */
  onChange?: (value: string, e: ChangeEvent<HTMLInputElement>) => void;
  /** Placeholder text. */
  placeholder?: string;
  /** Disabled state. @default false */
  disabled?: boolean;
  /** Whether the field is required. @default false */
  required?: boolean;
  /** HTML input type. @default 'text' */
  type?: 'text' | 'password' | 'email';
  /** Maximum number of characters allowed. @default undefined (unlimited) */
  maxLength?: number;
  /** Description text displayed between label and input. */
  description?: string;
  /** Error or status message. */
  statusMessage?: string;
  /** Whether to auto-focus on mount. @default false */
  autoFocus?: boolean;
  /** Additional class name. */
  className?: string;
  /** Inline styles. */
  style?: React.CSSProperties;
  /** Whether to visually hide the label. @default false */
  labelHidden?: boolean;
  /** Icon to display at the start of the input. */
  startIcon?: ReactNode;
  /** Whether to show a clear button when a value is set. @default false */
  clearable?: boolean;
  /** Input size. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * LunaClair Input — thin adapter over @astryxdesign/core TextInput.
 *
 * Provides a themed text input with label, validation state, and
 * accessibility built-in. Astryx handles ARIA attributes, focus
 * management, and status display.
 */
export function Input({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  type = 'text',
  maxLength,
  description,
  statusMessage,
  autoFocus = false,
  className,
  style,
  labelHidden = false,
  startIcon,
  clearable = false,
  size = 'md',
}: InputProps) {
  return (
    <TextInput
      label={label}
      isLabelHidden={labelHidden}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isDisabled={disabled}
      isRequired={required}
      type={type}
      // Astryx TextInput forwards unknown props to the native <input> via
      // its `...rest` spread, but `BaseProps` extends `HTMLAttributes`
      // (no `maxLength` — that's an `InputHTMLAttributes`-only prop), so the
      // attribute is cast through a single-property object. Runtime
      // behavior is the native browser limit; only the type needs the cast.
      {...({ maxLength } as Record<string, unknown>)}
      description={description}
      hasAutoFocus={autoFocus}
      startIcon={startIcon}
      hasClear={clearable}
      size={size}
      className={className}
      style={style}
      {...(statusMessage
        ? { status: { type: 'error' as const, message: statusMessage } }
        : undefined)}
    />
  );
}

Input.displayName = 'Input';
