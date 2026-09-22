import { useState, useCallback, useRef, useEffect } from 'react';
import type { AiModelCatalog } from '../../../domain/ai/services/aiModelCatalog';
import { useImporterContext } from './useImporterContext';

export interface AiCleanupDiffResult {
  candidateId: string;
  original: string;
  cleaned: string;
}

export interface AiCleanupState {
  isCleaning: boolean;
  diffResult: AiCleanupDiffResult | null;
  error: string | null;
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
  });
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const abortCleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isCleaning: false,
      diffResult: null,
      error: null,
    }));
  }, []);

  const cleanWithAi = useCallback(
    async (
      markdown: string,
      candidateId: string,
      title?: string,
      options?: { model?: string; catalog?: AiModelCatalog },
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
      }));

      try {
        const result = await cleanupWithAi.execute({
          markdown,
          title,
          model: options?.model,
          catalog: options?.catalog,
          signal: controller.signal,
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
        }));

        return diffResult;
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          return null;
        }
        const waitSeconds = extractCooldownSeconds(err);
        if (waitSeconds !== null) {
          const deadline = Date.now() + waitSeconds * 1000;
          setCooldownUntil(deadline);
          setCooldownSeconds(waitSeconds);
        }
        const message = err instanceof Error ? err.message : 'Failed to clean with AI';
        setState(prev => ({
          ...prev,
          isCleaning: false,
          diffResult: null,
          error: message || 'Failed to clean with AI',
        }));
        return null;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [cleanupWithAi],
  );

  const acceptCleanup = useCallback(() => {
    const cleaned = state.diffResult?.cleaned;
    setState(prev => ({ ...prev, diffResult: null }));
    return cleaned;
  }, [state.diffResult]);

  const rejectCleanup = useCallback(() => {
    setState(prev => ({ ...prev, diffResult: null }));
  }, []);

  return {
    ...state,
    cleanWithAi,
    acceptCleanup,
    rejectCleanup,
    abortCleanup,
    cooldownSeconds,
  };
}
