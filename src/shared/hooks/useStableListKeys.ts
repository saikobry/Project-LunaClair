import { useState } from 'react';

interface KeyedRow {
    text: string;
    id: string;
}

/**
 * Derives the next row cache from the current `items` and the previous cache,
 * preserving ids exactly like the original ref-based implementation:
 * - same length → carry each row's id by position (no remount on keystroke),
 *   refreshing the cached text so a later structural change can still match
 * - add/remove → keep ids of surviving rows by content match, mint fresh ids
 *   for appended rows; duplicate texts always get distinct ids (the `used`
 *   set prevents a cached row being matched twice)
 */
function deriveRows(items: readonly string[], cached: KeyedRow[]): KeyedRow[] {
    if (cached.length === items.length) {
        return items.map((text, i) => ({
            text,
            id: cached[i]?.id ?? crypto.randomUUID(),
        }));
    }
    const used = new Set<number>();
    return items.map((text) => {
        const match = cached.findIndex((row, i) => !used.has(i) && row.text === text);
        if (match !== -1) {
            used.add(match);
            return cached[match];
        }
        return { text, id: crypto.randomUUID() };
    });
}

/**
 * Returns a stable key per list row for `key={...}` in `.map()` loops.
 *
 * The question editors render payload rows that are plain strings with no
 * natural id (correctness is positional via `correctIndex`/`correctIndices`),
 * so index keys (`key={i}`) would reassign React state across the wrong DOM
 * nodes on reorder/filter, while content keys (`key={choice}`) would remount
 * the input on every keystroke and drop focus. This hook derives one id per
 * row (cached on the row) and preserves it across renders.
 *
 * The cache lives in component state, NOT a ref: rendering must stay pure
 * because React can replay or discard it, and the rule
 * `react-doctor/no-ref-current-in-render` forbids ref writes in the render
 * body. When `items` gets a new reference, the next rows are derived with a
 * guarded `setState` during render (the documented "adjusting state when a
 * prop changes" pattern) — React re-renders immediately with the new state
 * before committing, so the keys are correct on the very render where the
 * list changed and a discarded render can never leak minted ids. The
 * `prevItems` guard keeps the comparison convergent (no infinite loop).
 *
 * Contract: callers must pass a new array reference whenever the list content
 * changes (the standard React pattern — every content edit creates a new
 * array). Because re-derivation keys off the reference, an in-place-mutated
 * or memoized-stable array would return stale ids.
 */
export function useStableListKeys(items: readonly string[]): string[] {
    const [rows, setRows] = useState<KeyedRow[]>(() => deriveRows(items, []));
    const [prevItems, setPrevItems] = useState(items);

    if (prevItems !== items) {
        setPrevItems(items);
        setRows((prev) => deriveRows(items, prev));
    }

    return rows.map((row) => row.id);
}
