import * as stylex from '@stylexjs/stylex';
import { importerStyles } from '../styles/importer.stylex';
import type { ImportCandidate } from '../../../domain/importer/models/importer.types';
import { Loader2 } from 'lucide-react';

/**
 * Canonical status badge (`badgedot`) for importer candidates.
 *
 * One hue pair per state, with the dot repeating the text hue; `extracting` /
 * `saving` swap the dot for a spinner instead of inventing a sixth hue. The
 * label always renders, so state never rests on colour alone. Hues are the
 * sentiment roles only — `--color-danger` does not exist in Astryx.
 */
const STATUS_APPEARANCE = {
  pending: { badge: importerStyles.badgePending, dot: importerStyles.dotPending },
  extracting: { badge: importerStyles.badgeExtracting, dot: null },
  review: { badge: importerStyles.badgeReview, dot: importerStyles.dotReview },
  done: { badge: importerStyles.badgeDone, dot: importerStyles.dotDone },
  error: { badge: importerStyles.badgeError, dot: importerStyles.dotError },
  saving: { badge: importerStyles.badgeExtracting, dot: null },
} as const;

function isInFlight(status: ImportCandidate['status']): boolean {
  return status === 'extracting' || status === 'saving';
}

export function ImportStatusBadge({ status }: { status: ImportCandidate['status'] }) {
  const appearance = STATUS_APPEARANCE[status];

  if (isInFlight(status)) {
    return (
      // `role="status"` so the in-flight state is announced, not just drawn.
      <span
        {...stylex.props(importerStyles.badgedot, importerStyles.badgeExtracting)}
        role="status"
      >
        <Loader2 size={11} {...stylex.props(importerStyles.iconSpin)} aria-hidden="true" />
        {status}
      </span>
    );
  }

  return (
    <span {...stylex.props(importerStyles.badgedot, appearance.badge)}>
      <span {...stylex.props(importerStyles.dot, appearance.dot)} aria-hidden="true" />
      {status}
    </span>
  );
}
