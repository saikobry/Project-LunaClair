import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SEARCH_DEBOUNCE_MS, useExploreFilterDraft } from '../useExploreFilterDraft';

describe('useExploreFilterDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('seeds the draft from the committed query', () => {
    const { result } = renderHook(() =>
      useExploreFilterDraft({ q: 'cell', onCommit: vi.fn() }),
    );

    expect(result.current.search).toBe('cell');
  });

  it('debounces typing into a single commit', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useExploreFilterDraft({ onCommit }));

    act(() => {
      result.current.changeSearch('re');
      result.current.changeSearch('retro');
      result.current.changeSearch('retrosynthesis');
    });

    // Responsive immediately, silent to the URL until the delay elapses.
    expect(result.current.search).toBe('retrosynthesis');
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({ q: 'retrosynthesis', sort: undefined });
  });

  it('commits a cleared box as undefined rather than an empty string', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useExploreFilterDraft({ q: 'cell', sort: 'recent', onCommit }),
    );

    act(() => {
      result.current.changeSearch('   ');
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    expect(onCommit).toHaveBeenCalledWith({ q: undefined, sort: 'recent' });
  });

  it('does not commit a query that already matches the URL', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useExploreFilterDraft({ q: 'cell', onCommit }));

    act(() => {
      result.current.changeSearch('cell');
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('drops a queued commit when the URL changes from outside (Back)', () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ q }: { q?: string }) => useExploreFilterDraft({ q, onCommit }),
      { initialProps: { q: 'cell' as string | undefined } },
    );

    act(() => {
      result.current.changeSearch('cell biology');
    });

    // Back/Forward restores the URL before the debounce fires.
    rerender({ q: undefined });

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.search).toBe('');
  });

  it('clears the query immediately, bypassing the debounce', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useExploreFilterDraft({ q: 'cell', onCommit }));

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.search).toBe('');
    expect(onCommit).toHaveBeenCalledWith({ q: undefined, sort: undefined });
  });

  it('reports a sort change with the committed query', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useExploreFilterDraft({ q: 'cell', onCommit }));

    act(() => {
      result.current.changeSort('recent');
    });

    expect(onCommit).toHaveBeenCalledWith({ q: 'cell', sort: 'recent' });
  });

  it('cancels a queued commit on unmount', () => {
    const onCommit = vi.fn();
    const { result, unmount } = renderHook(() => useExploreFilterDraft({ onCommit }));

    act(() => {
      result.current.changeSearch('cell');
    });
    unmount();

    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2);
    });

    expect(onCommit).not.toHaveBeenCalled();
  });
});
