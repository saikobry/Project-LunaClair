import { type ReactNode, type CSSProperties } from 'react';
import * as stylex from '@stylexjs/stylex';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
    gap: 12,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  containerCompact: {
    padding: '24px 16px',
    gap: 8,
  },
  iconSlot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'var(--color-accent-muted)',
    color: 'var(--color-accent)',
    marginBottom: 4,
    flexShrink: 0,
  },
  iconSlotMuted: {
    backgroundColor: 'var(--color-background-muted)',
    color: 'var(--color-text-secondary)',
  },
  iconSlotCompact: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginBottom: 0,
  },
  heading: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
    lineHeight: 1.3,
    textAlign: 'center',
  },
  headingCompact: {
    fontSize: 15,
    fontWeight: 600,
  },
  description: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    margin: '0 auto',
    maxWidth: 380,
    lineHeight: 1.5,
    textAlign: 'center',
  },
  descriptionCompact: {
    fontSize: 13,
    maxWidth: 300,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  actionsCompact: {
    marginTop: 4,
    gap: 8,
  },
});

export interface EmptyStateProps {
  /** Decorative or contextual icon */
  icon?: ReactNode;
  /** Visual variant for the icon badge. @default 'accent' */
  iconVariant?: 'accent' | 'muted';
  /** Primary title of the empty state */
  title: string;
  /** Explanatory description */
  description?: string;
  /** Primary CTA button or element */
  action?: ReactNode;
  /** Secondary action element (e.g. clear filters) */
  secondaryAction?: ReactNode;
  /** Visual density variant. @default 'default' */
  size?: 'default' | 'compact';
  /** Heading semantic level. @default 'h2' */
  headingLevel?: 'h2' | 'h3' | 'h4';
  /** Optional class name */
  className?: string;
  /** Optional inline styles */
  style?: CSSProperties;
}

/**
 * Standardized empty state primitive for zero-data or filtered empty collections.
 * Uses semantic heading structure and icon badge styling matching the design system.
 */
export function EmptyState({
  icon,
  iconVariant = 'accent',
  title,
  description,
  action,
  secondaryAction,
  size = 'default',
  headingLevel = 'h2',
  className,
  style,
}: EmptyStateProps) {
  const isCompact = size === 'compact';
  const isMuted = iconVariant === 'muted';
  const HeadingTag = headingLevel;

  const containerProps = stylex.props(
    styles.container,
    isCompact && styles.containerCompact
  );

  return (
    <div
      {...containerProps}
      className={
        className
          ? `${containerProps.className ?? ''} ${className}`.trim()
          : containerProps.className
      }
      style={
        style
          ? { ...containerProps.style, ...style }
          : containerProps.style
      }
    >
      {icon && (
        <div
          {...stylex.props(
            styles.iconSlot,
            isMuted && styles.iconSlotMuted,
            isCompact && styles.iconSlotCompact
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <HeadingTag
        {...stylex.props(
          styles.heading,
          isCompact && styles.headingCompact
        )}
      >
        {title}
      </HeadingTag>
      {description && (
        <p
          {...stylex.props(
            styles.description,
            isCompact && styles.descriptionCompact
          )}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div
          {...stylex.props(
            styles.actions,
            isCompact && styles.actionsCompact
          )}
        >
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

EmptyState.displayName = 'EmptyState';
