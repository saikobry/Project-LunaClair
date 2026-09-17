import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExploreSortOption } from '../../../../features/discovery/explore.types';
import type { ExploreFilters } from '../utils/exploreFilters';

/** Search is a network request, so typing is debounced before it reaches the URL. */
export const SEARCH_DEBOUNCE_MS = 250;

interface UseExploreFilterDraftParams extends ExploreFilters {
  /** Applies a committed filter change (the route owner applies it to the URL). */
  onCommit?: (next: ExploreFilters) => void;
}

/**
 * Owns the *in-progress* search query only; the committed query lives in the URL.
 *
 * Typing debounces into `onCommit` from the change handler rather than from an
 * effect. An effect that pushed state to the parent would also re-publish a
 * stale query whenever the URL changed from outside (Back/Forward, a pasted
 * link), fighting the view the user just navigated to.
 */
export function useExploreFilterDraft({ q, sort, onCommit }: UseExploreFilterDraftParams) {
  const [search, setSearch] = useState(q ?? '');
  const timerRef = useRef<number | null>(null);

  // Latest committed values and callback, read by the timer when it fires (the
  // closure captured at typing time would otherwise be stale).
  const latestRef = useRef({ q, sort, onCommit });
  useEffect(() => {
    latestRef.current = { q, sort, onCommit };
  }, [q, sort, onCommit]);

  const cancelPendingCommit = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Re-seed the draft when the URL changes from outside, so the input never
  // shows a query the list is not using.
  const [seededQuery, setSeededQuery] = useState(q);
  if (q !== seededQuery) {
    setSeededQuery(q);
    setSearch(q ?? '');
  }

  // A restored URL (Back/Forward) supersedes anything still queued.
  useEffect(() => {
    cancelPendingCommit();
  }, [q, cancelPendingCommit]);

  useEffect(() => cancelPendingCommit, [cancelPendingCommit]);

  const changeSearch = useCallback(
    (raw: string) => {
      setSearch(raw);
      cancelPendingCommit();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const { q: committedQuery, sort: committedSort, onCommit: commit } = latestRef.current;
        const nextQuery = raw.trim() || undefined;
        if (nextQuery === committedQuery) return;
        commit?.({ q: nextQuery, sort: committedSort });
      }, SEARCH_DEBOUNCE_MS);
    },
    [cancelPendingCommit],
  );

  const clearSearch = useCallback(() => {
    cancelPendingCommit();
    setSearch('');
    onCommit?.({ q: undefined, sort });
  }, [cancelPendingCommit, onCommit, sort]);

  const changeSort = useCallback(
    (next: ExploreSortOption) => {
      onCommit?.({ q, sort: next });
    },
    [onCommit, q],
  );

  return { search, changeSearch, clearSearch, changeSort };
}
