import { type ReactNode } from 'react';
import { Banner as AstryxBanner } from '@astryxdesign/core/Banner';

export type BannerVariant = 'info' | 'warning' | 'success' | 'error';

export interface BannerProps {
  /** Banner title (text or rich content). */
  title: ReactNode;
  /** Optional description below the title. */
  description?: ReactNode;
  /** Visual variant controlling the icon and color scheme. @default 'info' */
  variant?: BannerVariant;
  /** Action elements rendered end-aligned (e.g. Buttons). */
  action?: ReactNode;
  /** Whether the banner can be dismissed. @default false */
  isDismissable?: boolean;
  /** Called when the dismiss button is clicked. */
  onDismiss?: () => void;
  /** Container type. @default 'card' */
  container?: 'card' | 'section';
  /** Extra collapsible content rendered below the header. */
  children?: ReactNode;
  /** Additional class name. */
  className?: string;
  /** Inline styles. */
  style?: React.CSSProperties;
}

/**
 * LunaClair Banner — thin adapter over @astryxdesign/core Banner.
 *
 * Exposes the LunaClair-owned `variant` prop (mapped to Astryx's `status`)
 * and an `action` slot (mapped to Astryx's `endContent`). The banner sets
 * `role="alert"` for warning/error and `role="status"` for info/success.
 */
export function Banner({
  title,
  description,
  variant = 'info',
  action,
  isDismissable = false,
  onDismiss,
  container = 'card',
  children,
  className,
  style,
}: BannerProps) {
  return (
    <AstryxBanner
      status={variant}
      title={title}
      description={description}
      endContent={action}
      isDismissable={isDismissable}
      onDismiss={onDismiss}
      container={container}
      className={className}
      style={style}
    >
      {children}
    </AstryxBanner>
  );
}

Banner.displayName = 'Banner';
