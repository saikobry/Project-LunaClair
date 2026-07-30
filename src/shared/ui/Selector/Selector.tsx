import { Selector as AstryxSelector } from '@astryxdesign/core/Selector';
import type { SelectorOptionData } from '@astryxdesign/core/Selector';

export interface SelectorOption {
  value: string;
  label: string;
  disabled?: boolean;
}

function mapOptions(options: SelectorOption[]): SelectorOptionData[] {
  return options.map((opt) => ({
    value: opt.value,
    label: opt.label,
    disabled: opt.disabled,
  }));
}

export interface SelectorProps {
  /** Accessible label. */
  label: string;
  /** Available options. */
  options: SelectorOption[];
  /** Current value. */
  value: string;
  /** Change handler. */
  onChange?: (value: string) => void;
  /** Placeholder text. @default 'Select…' */
  placeholder?: string;
  /** Disabled state. @default false */
  disabled?: boolean;
  /** Required field state. @default false */
  required?: boolean;
  /** Whether to visually hide the label. @default false */
  isLabelHidden?: boolean;
  /** Whether to show a search input for filtering options. @default false */
  hasSearch?: boolean;
  /** Search input placeholder. @default 'Search…' */
  searchPlaceholder?: string;
  /** Size. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Width. Numbers = pixels, strings = CSS value. */
  width?: string | number;
  /** Additional class name. */
  className?: string;
  /** Inline styles. */
  style?: React.CSSProperties;
  /** ARIA label (overrides visible label for screen readers). */
  'aria-label'?: string;
}

/**
 * LunaClair Selector — thin adapter over @astryxdesign/core Selector.
 *
 * Provides a themed dropdown/combobox with search, disabled states,
 * and accessibility built-in. Wraps the options in the format expected
 * by Astryx Selector.
 */
export function Selector({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  required = false,
  isLabelHidden = false,
  hasSearch = false,
  searchPlaceholder = 'Search…',
  size = 'md',
  width,
  className,
  style,
  ...ariaProps
}: SelectorProps) {
  return (
    <AstryxSelector
      label={label}
      isLabelHidden={isLabelHidden}
      options={mapOptions(options)}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isDisabled={disabled}
      isRequired={required}
      hasSearch={hasSearch}
      searchPlaceholder={searchPlaceholder}
      size={size}
      width={width}
      className={className}
      style={style}
      {...ariaProps}
    />
  );
}

Selector.displayName = 'Selector';
