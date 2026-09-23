import * as stylex from '@stylexjs/stylex';
import { Check } from 'lucide-react';
import type { ImportSession } from '../../../../domain/importer/models/importer.types';

/**
 * Visual + textual progress for the import wizard.
 *
 * The screen owns the steps; this component only presents them. S1 layout: a
 * single connected breadcrumb pipeline — 20px nodes joined by accent/border
 * connectors, each label sitting directly beneath its node, and the
 * `Step X of 5: ...` caption visually hidden on desktop so the strip costs
 * ~40px instead of the previous ~80px.
 *
 * The caption is the acceptance-suite contract: it is the only element
 * carrying that string, it is a leaf (no nested wrapper), and it stays in the
 * accessible tree at every breakpoint. `sr-only` is still "visible" to
 * Playwright — visibility is computed from the bounding box, not `clip-path`.
 */

const STEPS: ReadonlyArray<{
  status: ImportSession['status'];
  short: string;
  caption: string;
}> = [
  { status: 'selecting', short: 'Files', caption: 'Step 1 of 5: Select Files' },
  { status: 'extracting', short: 'Extract', caption: 'Step 2 of 5: Extracting Text' },
  { status: 'review', short: 'Review', caption: 'Step 3 of 5: Review Content' },
  { status: 'details', short: 'Details', caption: 'Step 4 of 5: Material Details' },
  { status: 'completed', short: 'Completed', caption: 'Step 5 of 5: Completed' },
];

const mobile = '@media (max-width: 640px)';

const styles = stylex.create({
  wrapper: {
    position: 'relative',
    marginBottom: '16px',
  },
  bar: {
    display: 'flex',
    alignItems: 'flex-start',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  itemGrow: {
    flex: 1,
  },
  nodeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    width: '100%',
  },
  badge: {
    width: 20,
    height: 20,
    flexShrink: 0,
    borderRadius: 'var(--radius-full)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 600,
  },
  badgeComplete: {
    backgroundColor: 'var(--color-accent)',
    color: 'var(--color-on-accent)',
  },
  badgeCurrent: {
    backgroundColor: 'var(--color-accent)',
    color: 'var(--color-on-accent)',
    fontWeight: 700,
  },
  badgeUpcoming: {
    backgroundColor: 'var(--color-background-muted)',
    color: 'var(--color-text-secondary)',
  },
  connector: {
    height: 2,
    flex: 1,
    minWidth: 12,
    borderRadius: 1,
  },
  connectorComplete: {
    backgroundColor: 'var(--color-accent)',
  },
  connectorUpcoming: {
    backgroundColor: 'var(--color-border)',
  },
  label: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    textAlign: 'center',
    [mobile]: {
      display: 'none',
    },
  },
  labelActive: {
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  caption: {
    position: 'absolute',
    width: 1,
    height: 1,
    margin: -1,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
    [mobile]: {
      // Labels are hidden on mobile, so the caption becomes the visible
      // subtitle for the strip instead of carrying state for screen readers
      // only.
      position: 'static',
      width: 'auto',
      height: 'auto',
      margin: '6px 0 0',
      overflow: 'visible',
      clipPath: 'none',
      whiteSpace: 'normal',
      fontSize: 12,
      color: 'var(--color-text-secondary)',
      textAlign: 'center',
    },
  },
});

export interface ImporterStepperProps {
  currentStep: ImportSession['status'];
}

export function ImporterStepper({ currentStep }: ImporterStepperProps) {
  const activeIndex = STEPS.findIndex((step) => step.status === currentStep);
  // `saving` is a transient status between the details and completed steps, so
  // it reports progress on the Details step without claiming a caption of its
  // own (the wizard is mid-commit, not on a step the user can act on).
  const resolvedIndex =
    activeIndex >= 0 ? activeIndex : STEPS.findIndex((step) => step.status === 'details');
  const caption = activeIndex >= 0 ? STEPS[activeIndex].caption : undefined;

  return (
    <nav aria-label="Import progress" {...stylex.props(styles.wrapper)}>
      <ol {...stylex.props(styles.bar)}>
        {STEPS.map((step, index) => {
          const isComplete = index < resolvedIndex;
          const isCurrent = index === resolvedIndex;
          const stateLabel = isComplete ? 'completed' : isCurrent ? 'current step' : 'upcoming';

          return (
            <li
              key={step.status}
              // The node itself is only a glyph, so its name lives here: the
              // accessible name never renders text into the step's own label.
              aria-label={`Step ${index + 1}: ${step.short}, ${stateLabel}`}
              aria-current={isCurrent ? 'step' : undefined}
              {...stylex.props(styles.item, index < STEPS.length - 1 && styles.itemGrow)}
            >
              <div {...stylex.props(styles.nodeRow)}>
                <span
                  aria-hidden="true"
                  {...stylex.props(
                    styles.badge,
                    isComplete && styles.badgeComplete,
                    isCurrent && styles.badgeCurrent,
                    !isComplete && !isCurrent && styles.badgeUpcoming,
                  )}
                >
                  {isComplete ? <Check size={12} strokeWidth={2.5} /> : index + 1}
                </span>
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    {...stylex.props(
                      styles.connector,
                      index <= resolvedIndex ? styles.connectorComplete : styles.connectorUpcoming,
                    )}
                  />
                )}
              </div>
              <span {...stylex.props(styles.label, isCurrent && styles.labelActive)}>
                {step.short}
              </span>
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" {...stylex.props(styles.caption)}>
        {caption}
      </p>
    </nav>
  );
}

ImporterStepper.displayName = 'ImporterStepper';
