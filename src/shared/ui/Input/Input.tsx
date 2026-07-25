import { type ChangeEvent } from 'react';
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
  isDisabled?: boolean;
  /** Whether the field is required. @default false */
  isRequired?: boolean;
  /** HTML input type. @default 'text' */
  type?: 'text' | 'password' | 'email';
  /** Description text displayed between label and input. */
  description?: string;
  /** Error or status message. */
  statusMessage?: string;
  /** Whether to auto-focus on mount. @default false */
  hasAutoFocus?: boolean;
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
  isDisabled = false,
  isRequired = false,
  type = 'text',
  description,
  statusMessage,
  hasAutoFocus = false,
}: InputProps) {
  return (
    <TextInput
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isRequired={isRequired}
      type={type}
      description={description}
      hasAutoFocus={hasAutoFocus}
      {...(statusMessage
        ? { status: { type: 'error' as const, message: statusMessage } }
        : undefined)}
    />
  );
}

Input.displayName = 'Input';
