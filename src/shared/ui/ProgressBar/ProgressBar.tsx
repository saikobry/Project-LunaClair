import * as stylex from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';

export interface ProgressBarProps {
  value: number;
  max?: number; // default 100
  label?: string; // default 'Progress'
  variant?: 'accent' | 'success' | 'warning'; // default 'accent'
  size?: 'sm' | 'md'; // default 'md' (sm: 4px height, md: 8px height)
  xstyle?: StyleXStyles;
  className?: string;
}

const styles = stylex.create({
  track: {
    width: '100%',
    backgroundColor: 'var(--color-background-muted)',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  sm: {
    height: 4,
  },
  md: {
    height: 8,
  },
  fill: {
    height: '100%',
    borderRadius: 9999,
    transition: 'width 0.2s ease',
  },
  fillAccent: {
    backgroundColor: 'var(--color-accent)',
  },
  fillSuccess: {
    backgroundColor: 'var(--color-success)',
  },
  fillWarning: {
    backgroundColor: 'var(--color-warning)',
  },
});

/**
 * Accessible, reusable progress bar component.
 *
 * Adheres to WAI-ARIA progressbar role patterns and uses StyleX for static
 * layout and theme styling.
 */
export function ProgressBar({
  value,
  max = 100,
  label = 'Progress',
  variant = 'accent',
  size = 'md',
  xstyle,
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? value : 0;
  const percent = Math.min(100, Math.max(0, (safeValue / safeMax) * 100));

  const trackProps = stylex.props(
    styles.track,
    size === 'sm' ? styles.sm : styles.md,
    xstyle,
  );

  const fillVariantStyle =
    variant === 'success'
      ? styles.fillSuccess
      : variant === 'warning'
        ? styles.fillWarning
        : styles.fillAccent;

  const fillProps = stylex.props(styles.fill, fillVariantStyle);

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      {...trackProps}
      className={
        className
          ? `${trackProps.className ?? ''} ${className}`.trim()
          : trackProps.className
      }
    >
      {/**
       * Note: StyleX compiles static atomic CSS classes at build time. Continuously
       * variable dynamic dimensions (such as `width: ${percent}%` for progress bars)
       * cannot be pre-compiled into atomic classes without generating thousands of
       * CSS rules. Using an inline `style={{ width: `${percent}%` }}` companion alongside
       * `stylex.props` is intentional and the standard pattern for dynamic continuous widths in StyleX.
       */}
      <div
        {...fillProps}
        style={{
          ...fillProps.style,
          width: `${percent}%`,
        }}
      />
    </div>
  );
}

ProgressBar.displayName = 'ProgressBar';
