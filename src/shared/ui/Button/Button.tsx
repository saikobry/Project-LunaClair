import { type ReactNode } from 'react';
import { Button as AstryxButton } from '@astryxdesign/core/Button';
import type { ButtonVariant as AstryxButtonVariant } from '@astryxdesign/core/Button';

/**
 * LunaClair Button variant.
 * - primary: filled accent button
 * - secondary: outlined/default button
 * - danger: destructive action button
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger';

/** Maps LunaClair ButtonVariant to Astryx ButtonVariant. */
function mapVariant(variant?: ButtonVariant): AstryxButtonVariant {
  switch (variant) {
    case 'danger':
      return 'destructive';
    case 'secondary':
      return 'secondary';
    case 'primary':
    default:
      return 'primary';
  }
}

export interface ButtonProps {
  /** Accessible label (always required for Astryx Button). */
  label: string;
  /** Visual variant. @default 'primary' */
  variant?: ButtonVariant;
  /** Disabled state. @default false */
  isDisabled?: boolean;
  /** Loading state. @default false */
  isLoading?: boolean;
  /** Click handler. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** HTML type attribute. @default 'button' */
  type?: 'button' | 'submit' | 'reset';
  /** Optional icon element. */
  icon?: ReactNode;
  /** Icon-only mode. @default false */
  isIconOnly?: boolean;
  /** Child content rendered as visible text. */
  children?: ReactNode;
  /** Tooltip text on hover. */
  tooltip?: string;
  /** Full-width button. */
  width?: string | number;
}

/**
 * LunaClair Button — thin adapter over @astryxdesign/core Button.
 *
 * Exposes LunaClair-owned props instead of Astryx's. Maps `danger`
 * variant to `destructive`, `primary` to `primary`, and `secondary`
 * to `secondary`. All accessibility, focus management, disabled states,
 * and keyboard navigation are inherited from Astryx.
 */
export function Button({
  variant = 'primary',
  isDisabled = false,
  isLoading = false,
  type = 'button',
  icon,
  isIconOnly = false,
  label,
  children,
  tooltip,
  width,
  onClick,
}: ButtonProps) {
  return (
    <AstryxButton
      label={label}
      variant={mapVariant(variant)}
      isDisabled={isDisabled}
      isLoading={isLoading}
      type={type}
      icon={icon}
      isIconOnly={isIconOnly}
      tooltip={tooltip}
      width={width}
      onClick={onClick}
    >
      {children}
    </AstryxButton>
  );
}

Button.displayName = 'Button';
