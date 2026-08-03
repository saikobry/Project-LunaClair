import { type ReactNode, type Ref, type HTMLAttributes } from 'react';
import type { StyleXStyles } from '@stylexjs/stylex';
import { IconButton as AstryxIconButton } from '@astryxdesign/core/IconButton';
import { mapButtonVariant, type ButtonVariant } from '../Button/buttonVariant';

export interface IconButtonProps {
  /** Accessible label. Rendered as aria-label (icon-only button, no visible text). */
  label: string;
  /** Icon element rendered inside the button (required). */
  icon: ReactNode;
  /** Visual variant. @default 'ghost' (borderless — recommended for dense rows/toolbars) */
  variant?: ButtonVariant;
  /** Disabled state. @default false */
  isDisabled?: boolean;
  /** Loading state. @default false */
  isLoading?: boolean;
  /** HTML type attribute. @default 'button' */
  type?: 'button' | 'submit' | 'reset';
  /** Tooltip text shown on hover. */
  tooltip?: string;
  /** Button size. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Click handler. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Ref forwarded to the underlying button element (e.g. for drag handles). */
  ref?: Ref<HTMLButtonElement>;
  /** Additional class name. */
  className?: string;
  /** Inline styles. */
  style?: React.CSSProperties;
  /** StyleX overrides merged with the base button styles. */
  xstyle?: StyleXStyles;
  /** Additional ARIA attributes. */
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: HTMLAttributes<HTMLElement>['aria-haspopup'];
  /** Pass-through data attributes (e.g. `data-drag-handle`). */
  [key: `data-${string}`]: string | undefined;
}

/**
 * LunaClair IconButton — thin adapter over @astryxdesign/core IconButton
 * (which is Button with `isIconOnly` always true).
 *
 * Exposes LunaClair-owned props instead of Astryx's. Maps `danger` variant
 * to `destructive`, `primary` to `primary`, `secondary` to `secondary`,
 * and `ghost` to `ghost`. Use ghost in dense lists/toolbars to reduce
 * visual clutter. All accessibility, focus management, disabled states,
 * tooltips, and keyboard navigation are inherited from Astryx.
 */
export function IconButton({
  variant = 'ghost',
  isDisabled = false,
  isLoading = false,
  type = 'button',
  label,
  icon,
  tooltip,
  size,
  className,
  style,
  xstyle,
  onClick,
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <AstryxIconButton
      ref={ref}
      label={label}
      variant={mapButtonVariant(variant)}
      isDisabled={isDisabled}
      isLoading={isLoading}
      type={type}
      icon={icon}
      tooltip={tooltip}
      size={size}
      className={className}
      style={style}
      xstyle={xstyle}
      onClick={onClick}
      {...rest}
    />
  );
}

IconButton.displayName = 'IconButton';
