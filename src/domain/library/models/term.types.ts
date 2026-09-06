import type { Term } from './Term';

/**
 * Canonical academic terms (Prelim / Midterm / Finals) synced into the local
 * terms store when first-run onboarding completes.
 *
 * Bundled app constant — the source of truth for default terms, decoupled
 * from the remote catalog. Timestamps are assigned by the caller at write
 * time (`Term` requires `createdAt`/`updatedAt`).
 */
export const CANONICAL_DEFAULT_TERMS: ReadonlyArray<Pick<Term, 'id' | 'title'>> = [
  { id: 'prelim', title: 'Prelim' },
  { id: 'midterm', title: 'Midterm' },
  { id: 'finals', title: 'Finals' },
];