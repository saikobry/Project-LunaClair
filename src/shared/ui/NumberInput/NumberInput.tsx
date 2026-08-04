import { type MouseEvent } from 'react';
import { NumberInput as AstryxNumberInput } from '@astryxdesign/core/NumberInput';

export interface NumberInputProps {
  /** Label text for the input (always rendered for accessibility). */
  label: string;
  /** Whether to visually hide the label. @default false */
  isLabelHidden?: boolean;
  /** Current value. Use null/undefined for an empty field. */
  value: number | null | undefined;
  /** Change handler — only fires with valid numbers. */
  onChange?: (value: number) => void;
  /** Minimum value allowed. */
  min?: number | null;
  /** Maximum value allowed. */
  max?: number | null;
  /** Step increment. @default 1 */
  step?: number | null;
  /** Input size. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Units text displayed at the end of the input (e.g. "%" or "GB"). */
  units?: string | null;
  /** Width. Numbers = pixels, strings = CSS value. */
  width?: string | number;
  /** Disabled state. @default false */
  isDisabled?: boolean;
  /** Whether the field is required. @default false */
  isRequired?: boolean;
  /** Placeholder text shown when the input is empty. */
  placeholder?: string;
  /** Whether to only allow integer values. @default false */
  isIntegerOnly?: boolean;
  /** Additional class name. */
  className?: string;
  /** Inline styles. */
  style?: React.CSSProperties;
  /** Click handler on the input element. */
  onClick?: (event: MouseEvent<HTMLInputElement>) => void;
  /** ARIA label (overrides the visible label for screen readers). */
  'aria-label'?: string;
}

/**
 * LunaClair NumberInput — thin adapter over @astryxdesign/core NumberInput.
 *
 * Provides a themed numeric input with label, min/max/step validation,
 * optional units suffix, and accessibility built-in. Astryx only fires
 * onChange with valid numbers, so callers receive clean numeric values.
 */
export function NumberInput({
  label,
  isLabelHidden = false,
  value,
  onChange,
  min,
  max,
  step,
  size = 'md',
  units,
  width,
  isDisabled = false,
  isRequired = false,
  placeholder,
  isIntegerOnly = false,
  className,
  style,
  onClick,
  ...ariaProps
}: NumberInputProps) {
  return (
    <AstryxNumberInput
      label={label}
      isLabelHidden={isLabelHidden}
      value={value}
      onChange={(value) => onChange?.(value)}
      min={min}
      max={max}
      step={step}
      size={size}
      units={units}
      width={width}
      isDisabled={isDisabled}
      isRequired={isRequired}
      placeholder={placeholder}
      isIntegerOnly={isIntegerOnly}
      className={className}
      style={style}
      onClick={onClick}
      {...ariaProps}
    />
  );
}

NumberInput.displayName = 'NumberInput';
