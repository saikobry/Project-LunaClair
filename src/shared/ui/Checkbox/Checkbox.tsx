import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';

export interface CheckboxProps {
  /** Label text for the checkbox (always rendered for accessibility). */
  label: string;
  /** Whether to visually hide the label. @default false */
  isLabelHidden?: boolean;
  /** Whether the checkbox is checked. */
  isChecked: boolean;
  /** Change handler. */
  onChange?: (checked: boolean) => void;
  /** Disabled state. @default false */
  isDisabled?: boolean;
  /** Description text displayed below the label. */
  description?: string;
  /** Checkbox size. @default 'md' */
  size?: 'sm' | 'md';
  /** Additional class name. */
  className?: string;
  /** Inline styles. */
  style?: React.CSSProperties;
  /** ARIA label (overrides the visible label for screen readers). */
  'aria-label'?: string;
}

/**
 * LunaClair Checkbox — thin adapter over @astryxdesign/core CheckboxInput.
 *
 * Exposes the LunaClair-owned `isChecked` prop (mapped to Astryx's `value`)
 * and a plain `(checked) => void` change handler. Label association,
 * focus management, and disabled states are inherited from Astryx.
 */
export function Checkbox({
  label,
  isLabelHidden = false,
  isChecked,
  onChange,
  isDisabled = false,
  description,
  size = 'md',
  className,
  style,
  ...ariaProps
}: CheckboxProps) {
  return (
    <CheckboxInput
      label={label}
      isLabelHidden={isLabelHidden}
      value={isChecked}
      onChange={(checked) => onChange?.(checked)}
      isDisabled={isDisabled}
      description={description}
      size={size}
      className={className}
      style={style}
      {...ariaProps}
    />
  );
}

Checkbox.displayName = 'Checkbox';
