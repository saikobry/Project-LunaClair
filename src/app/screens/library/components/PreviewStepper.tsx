import * as stylex from '@stylexjs/stylex';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { screenStyles } from '../styles/libraryScreen.stylex';
import { MAX_PREVIEW_LEVEL, OVERVIEW_STEPS } from '../utils/overviewSteps';

export interface PreviewStepperProps {
  /** Items shown at the current level (already capped). */
  shown: number;
  /** Items matching the active query, ignoring the cap. */
  total: number;
  level: number;
  onLevelChange: (level: number) => void;
  onViewAll: () => void;
  /** Plural noun for labels, e.g. `collections` / `materials`. */
  noun: string;
}

/**
 * 6 → 12 → 25 stepper under a capped overview preview. `Show more` climbs one
 * level, `Show less` steps back. The `View all` tab jump only earns its place
 * past the last step (25) — anything at or below it expands fully in place.
 * Rendered only when the uncapped list exceeds the first step.
 */
export function PreviewStepper({ shown, total, level, onLevelChange, onViewAll, noun }: PreviewStepperProps) {
  const needsTab = total > OVERVIEW_STEPS[MAX_PREVIEW_LEVEL];
  // With 7 of 7 showing at level 1, there is nothing left to reveal —
  // the level alone would still offer another step up to 25.
  const canRevealMore = level < MAX_PREVIEW_LEVEL && shown < total;
  return (
    <div {...stylex.props(screenStyles.stepper)}>
      {canRevealMore && (
        <button
          type="button"
          {...stylex.props(screenStyles.stepperAction)}
          onClick={() => onLevelChange(level + 1)}
          aria-label={`Show more ${noun}`}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Show more <ChevronDown size={13} aria-hidden="true" />
          </span>
        </button>
      )}
      {level > 0 && (
        <>
          <span {...stylex.props(screenStyles.stepperCount)}>
            Showing {shown} of {total}
          </span>
          <button
            type="button"
            {...stylex.props(screenStyles.stepperAction)}
            onClick={() => onLevelChange(level - 1)}
            aria-label={`Show fewer ${noun}`}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ChevronUp size={13} aria-hidden="true" /> Show less
            </span>
          </button>
        </>
      )}
      {needsTab && (
        <button
          type="button"
          {...stylex.props(screenStyles.stepperLink)}
          onClick={onViewAll}
        >
          View all {total} {noun}
        </button>
      )}
    </div>
  );
}

export default PreviewStepper;
