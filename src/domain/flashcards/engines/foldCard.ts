import { compareHlc } from '../../sync/utils/hlc';
import type { CardState } from '../models/CardState';
import type { ReviewLog } from '../models/ReviewLog';

export interface Scheduler {
  next(
    prev: CardState | undefined,
    rating: 1 | 2 | 3 | 4,
    at: number,
    cardKey: string
  ): CardState;
}

export type CardScheduler = Scheduler;

export interface ReviewLogFoldItem extends ReviewLog {
  _hlc?: string;
}

function compareHlcStrings(a?: string, b?: string): number {
  if (a === b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return compareHlc(a, b);
}

function logOrder(a: ReviewLogFoldItem, b: ReviewLogFoldItem): number {
  if (a.at !== b.at) {
    return a.at - b.at;
  }
  const hlcDiff = compareHlcStrings(a._hlc, b._hlc);
  if (hlcDiff !== 0) {
    return hlcDiff;
  }
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * Deterministically folds a list of review and keyframe logs into the current derived CardState.
 *
 * Invariants:
 * 1. Arrival-order independent: sorting by (at asc -> _hlc asc -> id asc) guarantees
 *    that any permutation of the same log collection produces the exact same state.
 * 2. Keyframe absorption: the latest keyframe establishes base state; all logs prior to or at
 *    the keyframe are absorbed, and only subsequent reviews are applied on top.
 * 3. Pure function: zero mutations, zero I/O, zero side effects.
 */
export function foldCard(
  logs: ReadonlyArray<ReviewLogFoldItem>,
  sched: Scheduler
): CardState | undefined {
  const sorted = [...logs].sort(logOrder);

  let start = -1;
  sorted.forEach((l, i) => {
    if (l.kind === 'keyframe') {
      start = i;
    }
  });

  const latestKeyframe = start >= 0 ? sorted[start] : undefined;
  let state: CardState | undefined = latestKeyframe?.state
    ? { ...latestKeyframe.state }
    : undefined;

  for (const l of sorted.slice(start + 1)) {
    if (l.kind === 'review' && l.rating) {
      state = sched.next(state, l.rating, l.at, l.cardKey);
    }
  }

  return state;
}
