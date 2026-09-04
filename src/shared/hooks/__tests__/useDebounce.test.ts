import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('returns the initial value immediately on mount', () => {
        const { result } = renderHook(() => useDebounce('initial', 500));
        expect(result.current).toBe('initial');
    });

    it('does not update debounced value before delay elapses', async () => {
        const { result, rerender } = renderHook(
            ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
            {
                initialProps: { value: 'initial', delay: 500 },
            },
        );

        rerender({ value: 'updated', delay: 500 });
        expect(result.current).toBe('initial');

        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });

        expect(result.current).toBe('initial');
    });

    it('updates debounced value after delay elapses', async () => {
        const { result, rerender } = renderHook(
            ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
            {
                initialProps: { value: 'initial', delay: 500 },
            },
        );

        rerender({ value: 'updated', delay: 500 });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        expect(result.current).toBe('updated');
    });

    it('cancels pending timer and only emits latest value on rapid changes', async () => {
        const { result, rerender } = renderHook(
            ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
            {
                initialProps: { value: 'first', delay: 400 },
            },
        );

        rerender({ value: 'second', delay: 400 });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(250);
        });
        expect(result.current).toBe('first');

        rerender({ value: 'third', delay: 400 });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(250);
        });
        expect(result.current).toBe('first');

        // Let the remaining 150ms elapse for 'third'
        await act(async () => {
            await vi.advanceTimersByTimeAsync(150);
        });
        expect(result.current).toBe('third');
    });

    it('respects dynamically changed delay', async () => {
        const { result, rerender } = renderHook(
            ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
            {
                initialProps: { value: 'initial', delay: 1000 },
            },
        );

        rerender({ value: 'updated', delay: 200 });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
        });

        expect(result.current).toBe('updated');
    });

    it('clears active timer on unmount', () => {
        const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
        const { rerender, unmount } = renderHook(
            ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
            {
                initialProps: { value: 'initial', delay: 500 },
            },
        );

        rerender({ value: 'updated', delay: 500 });
        unmount();

        expect(clearTimeoutSpy).toHaveBeenCalled();
    });
});
