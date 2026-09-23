import { useState, useCallback, useRef, useEffect } from 'react';
import type { AiModelCatalog } from '../../../domain/ai/services/aiModelCatalog';
import type { AiCleanupProgress } from '../../../application/use-cases/importer/CleanupImportWithAiUseCase';
import { useImporterContext } from './useImporterContext';

/** Re-exported so surfaces can render progress without reaching into the application layer. */
export type { AiCleanupProgress };

export interface AiCleanupDiffResult {
  candidateId: string;
  original: string;
  cleaned: string;
}

export interface AiCleanupState {
  isCleaning: boolean;
  diffResult: AiCleanupDiffResult | null;
  error: string | null;
  /** Live section progress of a long-document run; `null` for single-request runs. */
  progress: AiCleanupProgress | null;
  /** True when a chunked run failed partway and the cleaned sections can be reused. */
  canRetryRemaining: boolean;
}

export interface AiCleanupOptions {
  model?: string;
  catalog?: AiModelCatalog;
}

function extractCooldownSeconds(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const anyErr = err as { retryAfterSeconds?: number; message?: string };
  if (typeof anyErr.retryAfterSeconds === 'number' && anyErr.retryAfterSeconds > 0) {
    return Math.ceil(anyErr.retryAfterSeconds);
  }
  if (typeof anyErr.message === 'string') {
    const match = anyErr.message.match(/try again in (\d+)\s*s/i);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return null;
}

export function useAiCleanup() {
  const { cleanupWithAi } = useImporterContext();
  const [state, setState] = useState<AiCleanupState>({
    isCleaning: false,
    diffResult: null,
    error: null,
    progress: null,
    canRetryRemaining: false,
  });
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Whether the use case is holding cleaned sections from an interrupted run.
   *
   * Asked of the use case rather than mirrored from the thrown error: the cache is what the retry
   * actually consumes, so the button and the resume can never disagree about it. Optional-called
   * because a test double only has to provide `execute`.
   */
  const hasResume = useCallback(
    () => cleanupWithAi.hasPendingCleanupResume?.() ?? false,
    [cleanupWithAi],
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (cooldownUntil === null) return;

    const capturedDeadline = cooldownUntil;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((capturedDeadline - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (remaining <= 0) {
        setCooldownUntil(null);
      }
    };

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const startCooldown = useCallback((err: unknown) => {
    const waitSeconds = extractCooldownSeconds(err);
    if (waitSeconds === null) return;
    setCooldownUntil(Date.now() + waitSeconds * 1000);
    setCooldownSeconds(waitSeconds);
  }, []);

  const failRun = useCallback(
    (err: unknown, keepResume: boolean) => {
      startCooldown(err);
      const message = err instanceof Error ? err.message : 'Failed to clean with AI';
      setState(prev => ({
        ...prev,
        isCleaning: false,
        diffResult: null,
        progress: null,
        error: message || 'Failed to clean with AI',
        canRetryRemaining: keepResume && hasResume(),
      }));
    },
    [hasResume, startCooldown],
  );

  const abortCleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // An abandoned run has nothing to resume: the cache belongs to the failure the user dismissed.
    cleanupWithAi.clearPendingCleanupResume?.();
    setState(prev => ({
      ...prev,
      isCleaning: false,
      diffResult: null,
      error: null,
      progress: null,
      canRetryRemaining: false,
    }));
  }, [cleanupWithAi]);

  const cleanWithAi = useCallback(
    async (
      markdown: string,
      candidateId: string,
      title?: string,
      options?: AiCleanupOptions,
    ): Promise<AiCleanupDiffResult | null> => {
      // Abort any existing in-flight request on retry
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Clear prior diffResult and error when initiating a new cleanup
      setState(prev => ({
        ...prev,
        isCleaning: true,
        diffResult: null,
        error: null,
        progress: null,
        canRetryRemaining: false,
      }));

      try {
        const result = await cleanupWithAi.execute({
          markdown,
          title,
          model: options?.model,
          catalog: options?.catalog,
          signal: controller.signal,
          onProgress: progress => setState(prev => ({ ...prev, progress })),
        });

        if (controller.signal.aborted) {
          return null;
        }

        const diffResult: AiCleanupDiffResult = {
          candidateId,
          original: result.original,
          cleaned: result.cleaned,
        };

        setState(prev => ({
          ...prev,
          isCleaning: false,
          diffResult,
          error: null,
          progress: null,
          canRetryRemaining: false,
        }));

        return diffResult;
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          return null;
        }
        failRun(err, true);
        return null;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [cleanupWithAi, failRun],
  );

  /**
   * Cleans just the given text and hands the result back.
   *
   * Deliberately returns the string instead of opening the diff modal: the caller replaces the
   * selection in place, and the editor's own history is the review step — a modal for a paragraph
   * would be more ceremony than the two-second undo it replaces.
   */
  const cleanSelection = useCallback(
    async (
      text: string,
      title?: string,
      options?: AiCleanupOptions,
    ): Promise<string | null> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState(prev => ({
        ...prev,
        isCleaning: true,
        diffResult: null,
        error: null,
        progress: null,
        canRetryRemaining: false,
      }));

      try {
        const result = await cleanupWithAi.execute({
          markdown: text,
          title,
          model: options?.model,
          catalog: options?.catalog,
          signal: controller.signal,
          onProgress: progress => setState(prev => ({ ...prev, progress })),
        });

        if (controller.signal.aborted) {
          return null;
        }

        setState(prev => ({ ...prev, isCleaning: false, progress: null, error: null }));
        return result.cleaned;
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          return null;
        }
        // A selection run has no diff to resume into: the text is still selected, so the button is
        // the retry.
        failRun(err, false);
        return null;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [cleanupWithAi, failRun],
  );

  /** Resumes a failed long-document cleanup from the section that failed. */
  const retryRemaining = useCallback(
    async (candidateId: string): Promise<AiCleanupDiffResult | null> => {
      if (!hasResume()) {
        return null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState(prev => ({
        ...prev,
        isCleaning: true,
        diffResult: null,
        error: null,
        progress: null,
        canRetryRemaining: false,
      }));

      try {
        const result = await cleanupWithAi.retryCleanupRemaining({
          signal: controller.signal,
          onProgress: progress => setState(prev => ({ ...prev, progress })),
        });

        if (controller.signal.aborted) {
          return null;
        }

        const diffResult: AiCleanupDiffResult = {
          candidateId,
          original: result.original,
          cleaned: result.cleaned,
        };

        setState(prev => ({
          ...prev,
          isCleaning: false,
          diffResult,
          error: null,
          progress: null,
          canRetryRemaining: false,
        }));

        return diffResult;
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          return null;
        }
        failRun(err, true);
        return null;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [cleanupWithAi, failRun, hasResume],
  );

  const acceptCleanup = useCallback(() => {
    const cleaned = state.diffResult?.cleaned;
    setState(prev => ({ ...prev, diffResult: null }));
    return cleaned;
  }, [state.diffResult]);

  const rejectCleanup = useCallback(() => {
    setState(prev => ({ ...prev, diffResult: null, canRetryRemaining: false }));
  }, []);

  return {
    ...state,
    cleanWithAi,
    cleanSelection,
    retryRemaining,
    acceptCleanup,
    rejectCleanup,
    abortCleanup,
    cooldownSeconds,
  };
}
