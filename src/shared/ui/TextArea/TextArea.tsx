import { useEffect, useRef, type ChangeEvent } from 'react';
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
  /** Whether the textarea dynamically resizes height based on content. @default true */
  autoGrow?: boolean;
  /** Additional class name. */
  className?: string;
  /** Inline styles. */
  style?: React.CSSProperties;
}

/**
 * LunaClair TextArea — thin adapter over @astryxdesign/core TextArea with dynamic autogrowing height.
 *
 * Provides a themed multi-line text input with label, validation state,
 * dynamic content auto-expansion, and accessibility built-in.
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
  autoGrow = true,
  className,
  style,
}: TextAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoGrow) return;
    const textarea = containerRef.current?.querySelector('textarea');
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.resize = 'none';
      const lineHeight = 20;
      const minHeight = Math.max(rows * lineHeight + 16, 40);
      const newHeight = Math.max(minHeight, textarea.scrollHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [value, autoGrow, rows]);

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
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
    </div>
  );
}

TextArea.displayName = 'TextArea';
