import { useCallback, useEffect, useRef, useState } from 'react';

export type DraftAutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved';

export interface UseDraftAutosaveOptions<T> {
    /** Latest draft state; `null` disables autosave (e.g. while loading). */
    draft: T | null;
    /** Autosave master switch (e.g. disabled until recovery is resolved). */
    enabled: boolean;
    /** Persistence callback (feature-owned, e.g. writes to IndexedDB). */
    persist: (draft: T) => Promise<void>;
    /** Debounce window after each change. @default 2000 */
    debounceMs?: number;
    /** Maximum time between persists while actively editing. @default 30000 */
    maxIntervalMs?: number;
}

export interface UseDraftAutosaveResult {
    status: DraftAutosaveStatus;
    /** Immediately persists the latest draft (used before save/close). */
    flush: () => Promise<void>;
}

/**
 * Generic draft autosave policy hook.
 *
 * Enforces the recovery policy: debounce persisting after changes
 * (default 2s), throttle so long editing sessions persist at least every
 * `maxIntervalMs` (default 30s), and flush immediately on window blur and
 * before unload. Domain-neutral — the consumer supplies `persist`.
 */
export function useDraftAutosave<T>({
    draft,
    enabled,
    persist,
    debounceMs = 2000,
    maxIntervalMs = 30000,
}: UseDraftAutosaveOptions<T>): UseDraftAutosaveResult {
    const [status, setStatus] = useState<DraftAutosaveStatus>('idle');

    const draftRef = useRef<T | null>(draft);
    const persistRef = useRef(persist);
    const timerRef = useRef<number | null>(null);
    const lastPersistAtRef = useRef<number>(0);
    const inflightRef = useRef<Promise<void> | null>(null);
    const dirtyRef = useRef(false);
    const skipNextRef = useRef(true);

    // Keep refs in sync after every committed render (never during render,
    // which React can replay or discard — ref writes must stay in effects).
    useEffect(() => {
        draftRef.current = draft;
        persistRef.current = persist;
    });

    const clearTimer = useCallback(() => {
        if (timerRef.current != null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const runPersist = useCallback(async () => {
        const current = draftRef.current;
        if (current == null || !dirtyRef.current) return;
        if (inflightRef.current) return; // re-run queued below on completion
        dirtyRef.current = false;
        clearTimer();
        setStatus('saving');
        const run = persistRef.current(current)
            .then(() => {
                lastPersistAtRef.current = Date.now();
                setStatus('saved');
            })
            .catch(() => {
                dirtyRef.current = true;
                setStatus('pending');
            })
            .finally(() => {
                inflightRef.current = null;
                // A change landed while persisting — flush again.
                if (dirtyRef.current) void runPersist();
            });
        inflightRef.current = run;
        return run;
    }, [clearTimer]);

    const schedule = useCallback(() => {
        dirtyRef.current = true;
        setStatus('pending');
        const sinceLast = Date.now() - lastPersistAtRef.current;
        if (sinceLast >= maxIntervalMs) {
            void runPersist();
            return;
        }
        clearTimer();
        timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            void runPersist();
        }, Math.min(debounceMs, maxIntervalMs - sinceLast));
    }, [clearTimer, debounceMs, maxIntervalMs, runPersist]);

    const flush = useCallback(async () => {
        dirtyRef.current = true;
        clearTimer();
        await runPersist();
        if (inflightRef.current) await inflightRef.current;
    }, [clearTimer, runPersist]);

    // Debounce on every draft change (skips the initial assignment).
    useEffect(() => {
        if (!enabled || draft == null) return;
        if (skipNextRef.current) {
            skipNextRef.current = false;
            return;
        }
        schedule();
    }, [draft, enabled, schedule]);

    // Flush on window blur loss and before unload for crash recovery.
    useEffect(() => {
        if (!enabled) return;
        const onBlur = () => void flush();
        const onBeforeUnload = () => {
            const current = draftRef.current;
            if (current != null && dirtyRef.current) {
                void persistRef.current(current);
            }
        };
        window.addEventListener('blur', onBlur);
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => {
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('beforeunload', onBeforeUnload);
        };
    }, [enabled, flush]);

    // Cleanup on unmount/disable.
    useEffect(() => clearTimer, [clearTimer]);

    return { status, flush };
}
