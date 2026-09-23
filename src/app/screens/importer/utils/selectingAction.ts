import type { ImportCandidate } from '../../../../domain/importer/models/importer.types';

export type SelectingActionKind = 'extract' | 'review';

export interface SelectingAction {
  label: string;
  disabled: boolean;
  action: SelectingActionKind;
}

/**
 * Derives the Step 1 primary action from the candidate states.
 *
 * Returning to Files must never re-run extraction over work the user already
 * reviewed: the extractor is only offered while something is still unextracted
 * (`pending`) or failed (`error`), and "Continue to Review" returns to Step 3
 * without touching it. Pure so the transitions are unit-testable — the label
 * and its behaviour cannot drift apart.
 */
export function getSelectingAction(candidates: ImportCandidate[]): SelectingAction {
  if (candidates.length === 0) {
    return { label: 'Start Extraction', disabled: true, action: 'extract' };
  }

  const hasInFlight = candidates.some(
    (candidate) => candidate.status === 'extracting' || candidate.status === 'saving',
  );
  if (hasInFlight) {
    return { label: 'Extracting...', disabled: true, action: 'extract' };
  }

  const allFailed = candidates.every((candidate) => candidate.status === 'error');
  if (allFailed) {
    return { label: 'Retry Extraction', disabled: false, action: 'extract' };
  }

  const hasExtracted = candidates.some(
    (candidate) => candidate.status === 'review' || candidate.status === 'done',
  );
  const hasPending = candidates.some((candidate) => candidate.status === 'pending');
  if (hasPending) {
    return {
      label: hasExtracted ? 'Extract New Files' : 'Start Extraction',
      disabled: false,
      action: 'extract',
    };
  }

  if (hasExtracted) {
    return { label: 'Continue to Review', disabled: false, action: 'review' };
  }

  // Candidates exist but none is extractable or reviewable (e.g. every file
  // was filtered out) — nothing to do but offer a fresh start.
  return { label: 'Start Extraction', disabled: true, action: 'extract' };
}

/**
 * The candidate Review should open on: the first one that actually has content,
 * so returning to Step 3 never lands on a blank editor.
 */
export function firstReviewableIndex(candidates: ImportCandidate[]): number {
  const index = candidates.findIndex(
    (candidate) => candidate.status === 'review' || candidate.status === 'done',
  );
  return index === -1 ? 0 : index;
}
