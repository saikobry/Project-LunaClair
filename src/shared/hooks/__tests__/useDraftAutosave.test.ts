import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraftAutosave, type UseDraftAutosaveOptions } from '../useDraftAutosave';

describe('useDraftAutosave', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('initializes with idle status and does not persist initial draft', () => {
        const persist = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() =>
            useDraftAutosave({
                draft: { title: 'Initial' },
                enabled: true,
                persist,
            }),
        );

        expect(result.current.status).toBe('idle');
        expect(persist).not.toHaveBeenCalled();
    });

    it('does not schedule persistence when enabled is false', async () => {
        const persist = vi.fn().mockResolvedValue(undefined);
        const { result, rerender } = renderHook(
            (props: UseDraftAutosaveOptions<{ title: string }>) => useDraftAutosave(props),
            {
                initialProps: {
                    draft: { title: 'Initial' },
                    enabled: false,
                    persist,
                },
            },
        );

        act(() => {
            rerender({
                draft: { title: 'Updated' },
                enabled: false,
                persist,
            });
        });

        expect(result.current.status).toBe('idle');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        expect(persist).not.toHaveBeenCalled();
    });

    it('does not schedule persistence when draft is null', async () => {
        const persist = vi.fn().mockResolvedValue(undefined);
        const { result, rerender } = renderHook(
            (props: UseDraftAutosaveOptions<{ title: string } | null>) => useDraftAutosave(props),
            {
                initialProps: {
                    draft: null,
                    enabled: true,
                    persist,
                },
            },
        );

        act(() => {
            rerender({
                draft: null,
                enabled: true,
                persist,
            });
        });

        expect(result.current.status).toBe('idle');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        expect(persist).not.toHaveBeenCalled();
    });

    it('debounces persistence after draft changes and updates status to saved', async () => {
        const persist = vi.fn().mockResolvedValue(undefined);
        const { result, rerender } = renderHook(
            (props: UseDraftAutosaveOptions<{ title: string }>) => useDraftAutosave(props),
            {
                initialProps: {
                    draft: { title: 'Initial' },
                    enabled: true,
                    persist,
                    debounceMs: 2000,
                },
            },
        );

        // Update draft
        act(() => {
            rerender({
                draft: { title: 'First Edit' },
                enabled: true,
                persist,
                debounceMs: 2000,
            });
        });

        expect(result.current.status).toBe('pending');
        expect(persist).not.toHaveBeenCalled();

        // Advance before debounce window
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1500);
        });
        expect(persist).not.toHaveBeenCalled();
        expect(result.current.status).toBe('pending');

        // Advance to cross debounce threshold
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        expect(persist).toHaveBeenCalledTimes(1);
        expect(persist).toHaveBeenCalledWith({ title: 'First Edit' });
        expect(result.current.status).toBe('saved');
    });

    it('resets debounce timer on rapid consecutive edits', async () => {
        const persist = vi.fn().mockResolvedValue(undefined);
        const { result, rerender } = renderHook(
            (props: UseDraftAutosaveOptions<{ count: number }>) => useDraftAutosave(props),
            {
                initialProps: {
                    draft: { count: 0 },
                    enabled: true,
                    persist,
                    debounceMs: 1000,
                },
            },
        );

        // Edit 1
        act(() => {
            rerender({
                draft: { count: 1 },
                enabled: true,
                persist,
                debounceMs: 1000,
            });
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });
        expect(persist).not.toHaveBeenCalled();

        // Edit 2 before 1000ms
        act(() => {
            rerender({
                draft: { count: 2 },
                enabled: true,
                persist,
                debounceMs: 1000,
            });
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });
        expect(persist).not.toHaveBeenCalled();

        // Edit 3 before another 1000ms
        act(() => {
            rerender({
                draft: { count: 3 },
                enabled: true,
                persist,
                debounceMs: 1000,
            });
        });

        // Let full debounce elapse
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(persist).toHaveBeenCalledTimes(1);
        expect(persist).toHaveBeenCalledWith({ count: 3 });
        expect(result.current.status).toBe('saved');
    });

    it('throttles persistence when edits continue past maxIntervalMs', async () => {
        const persist = vi.fn().mockResolvedValue(undefined);

        const { rerender } = renderHook(
            (props: UseDraftAutosaveOptions<{ text: string }>) => useDraftAutosave(props),
            {
                initialProps: {
                    draft: { text: 'v0' },
                    enabled: true,
                    persist,
                    debounceMs: 2000,
                    maxIntervalMs: 5000,
                },
            },
        );

        // Edit 1
        act(() => {
            rerender({
                draft: { text: 'v1' },
                enabled: true,
                persist,
                debounceMs: 2000,
                maxIntervalMs: 5000,
            });
        });

        // Simulate typing every 1500ms (resets debounce timer)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1500);
        });
        act(() => {
            rerender({
                draft: { text: 'v2' },
                enabled: true,
                persist,
                debounceMs: 2000,
                maxIntervalMs: 5000,
            });
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1500);
        });
        act(() => {
            rerender({
                draft: { text: 'v3' },
                enabled: true,
                persist,
                debounceMs: 2000,
                maxIntervalMs: 5000,
            });
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1500);
        });
        act(() => {
            rerender({
                draft: { text: 'v4' },
                enabled: true,
                persist,
                debounceMs: 2000,
                maxIntervalMs: 5000,
            });
        });

        // Advance 1000ms more: total elapsed since mount is 5500ms >= maxIntervalMs (5000)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        // Forced throttle persist fires
        expect(persist).toHaveBeenCalledTimes(1);
        expect(persist).toHaveBeenCalledWith({ text: 'v4' });
    });

    it('queues a follow-up persist when a change occurs while persist is inflight', async () => {
        let resolveInflight!: () => void;
        const persist = vi.fn()
            .mockImplementationOnce(
                () =>
                    new Promise<void>((resolve) => {
                        resolveInflight = resolve;
                    }),
            )
            .mockResolvedValue(undefined);

        const { result, rerender } = renderHook(
            (props: UseDraftAutosaveOptions<{ count: number }>) => useDraftAutosave(props),
            {
                initialProps: {
                    draft: { count: 1 },
                    enabled: true,
                    persist,
                    debounceMs: 1000,
                },
            },
        );

        // Trigger first persist
        act(() => {
            rerender({
                draft: { count: 2 },
                enabled: true,
                persist,
                debounceMs: 1000,
            });
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });

        expect(result.current.status).toBe('saving');
        expect(persist).toHaveBeenCalledTimes(1);
        expect(persist).toHaveBeenLastCalledWith({ count: 2 });

        // While inflight, update draft again
        act(() => {
            rerender({
                draft: { count: 3 },
                enabled: true,
                persist,
                debounceMs: 1000,
            });
        });

        // Resolve first persist
        await act(async () => {
            resolveInflight();
        });

        // Second persist immediately ran with latest draft and completed
        expect(persist).toHaveBeenCalledTimes(2);
        expect(persist).toHaveBeenLastCalledWith({ count: 3 });
        expect(result.current.status).toBe('saved');
    });

    it('sets status back to pending and preserves dirty state on persist rejection without infinite recursion', async () => {
        const persist = vi.fn().mockRejectedValue(new Error('Network error'));
        const { result, rerender } = renderHook(
            (props: UseDraftAutosaveOptions<{ text: string }>) => useDraftAutosave(props),
            {
                initialProps: {
                    draft: { text: 'Initial' },
                    enabled: true,
                    persist,
                    debounceMs: 500,
                },
            },
        );

        act(() => {
            rerender({
                draft: { text: 'Failing edit' },
                enabled: true,
                persist,
                debounceMs: 500,
            });
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });

        expect(persist).toHaveBeenCalledTimes(1);
        expect(result.current.status).toBe('pending');

        // Can recover via flush once failure clears
        persist.mockResolvedValueOnce(undefined);
        await act(async () => {
            await result.current.flush();
        });

        expect(persist).toHaveBeenCalledTimes(2);
        expect(result.current.status).toBe('saved');
    });

    it('flush immediately persists pending changes without waiting for debounce', async () => {
        const persist = vi.fn().mockResolvedValue(undefined);
        const { result, rerender } = renderHook(
            (props: UseDraftAutosaveOptions<{ text: string }>) => useDraftAutosave(props),
            {
                initialProps: {
                    draft: { text: 'Initial' },
                    enabled: true,
                    persist,
                    debounceMs: 5000,
                },
            },
        );

        act(() => {
            rerender({
                draft: { text: 'Urgent edit' },
                enabled: true,
                persist,
                debounceMs: 5000,
            });
        });

        expect(result.current.status).toBe('pending');
        expect(persist).not.toHaveBeenCalled();

        await act(async () => {
            await result.current.flush();
        });

        expect(persist).toHaveBeenCalledTimes(1);
        expect(persist).toHaveBeenCalledWith({ text: 'Urgent edit' });
        expect(result.current.status).toBe('saved');
    });

    it('flushes on window blur event when dirty', async () => {
        const persist = vi.fn().mockResolvedValue(undefined);
        const { rerender } = renderHook(
            (props: UseDraftAutosaveOptions<{ text: string }>) => useDraftAutosave(props),
            {
                initialProps: {
                    draft: { text: 'Initial' },
                    enabled: true,
                    persist,
                    debounceMs: 5000,
                },
            },
        );

        act(() => {
            rerender({
                draft: { text: 'Blur edit' },
                enabled: true,
                persist,
                debounceMs: 5000,
            });
        });

        expect(persist).not.toHaveBeenCalled();

        await act(async () => {
            window.dispatchEvent(new Event('blur'));
        });

        expect(persist).toHaveBeenCalledTimes(1);
        expect(persist).toHaveBeenCalledWith({ text: 'Blur edit' });
    });

    it('persists on window beforeunload event when dirty', () => {
        const persist = vi.fn().mockResolvedValue(undefined);
        const { rerender } = renderHook(
            (props: UseDraftAutosaveOptions<{ text: string }>) => useDraftAutosave(props),
            {
                initialProps: {
                    draft: { text: 'Initial' },
                    enabled: true,
                    persist,
                    debounceMs: 5000,
                },
            },
        );

        act(() => {
            rerender({
                draft: { text: 'Unload edit' },
                enabled: true,
                persist,
                debounceMs: 5000,
            });
        });

        act(() => {
            window.dispatchEvent(new Event('beforeunload'));
        });

        expect(persist).toHaveBeenCalledTimes(1);
        expect(persist).toHaveBeenCalledWith({ text: 'Unload edit' });
    });

    it('does not persist on beforeunload or blur if not dirty', () => {
        const persist = vi.fn().mockResolvedValue(undefined);
        renderHook(() =>
            useDraftAutosave({
                draft: { text: 'Initial' },
                enabled: true,
                persist,
            }),
        );

        act(() => {
            window.dispatchEvent(new Event('blur'));
            window.dispatchEvent(new Event('beforeunload'));
        });

        expect(persist).not.toHaveBeenCalled();
    });

    it('cleans up timer and event listeners on unmount', () => {
        const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
        const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

        const { rerender, unmount } = renderHook(
            (props: UseDraftAutosaveOptions<{ text: string }>) => useDraftAutosave(props),
            {
                initialProps: {
                    draft: { text: 'Initial' },
                    enabled: true,
                    persist: vi.fn(),
                    debounceMs: 5000,
                },
            },
        );

        // Schedule an active timer
        act(() => {
            rerender({
                draft: { text: 'Unmounting edit' },
                enabled: true,
                persist: vi.fn(),
                debounceMs: 5000,
            });
        });

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
        expect(clearTimeoutSpy).toHaveBeenCalled();
    });
});
