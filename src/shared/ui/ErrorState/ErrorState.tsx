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
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    color: 'var(--color-error)',
    marginBottom: 4,
    flexShrink: 0,
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

export interface ErrorStateProps {
  /** Error or missing resource icon */
  icon?: ReactNode;
  /** Error title */
  title: string;
  /** Detailed error message or hint */
  description?: string;
  /** Recovery action (e.g. Retry or Back to Library) */
  action?: ReactNode;
  /** Secondary recovery action */
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
 * Standardized error/not-found primitive for missing resources, network failures, or unrecoverable states.
 * Uses semantic heading structure and error badge styling matching the design system.
 */
export function ErrorState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'default',
  headingLevel = 'h2',
  className,
  style,
}: ErrorStateProps) {
  const isCompact = size === 'compact';
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

ErrorState.displayName = 'ErrorState';
