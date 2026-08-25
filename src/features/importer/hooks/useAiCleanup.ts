import { useState, useCallback } from 'react';
import { useImporterContext } from './useImporterContext';

export interface AiCleanupState {
  isCleaning: boolean;
  diffResult: { original: string; cleaned: string } | null;
  error: string | null;
}

export function useAiCleanup() {
  const { cleanupWithAi } = useImporterContext();
  const [state, setState] = useState<AiCleanupState>({
    isCleaning: false,
    diffResult: null,
    error: null,
  });

  const cleanWithAi = useCallback(async (markdown: string, title?: string) => {
    setState(prev => ({ ...prev, isCleaning: true, error: null }));
    try {
      const result = await cleanupWithAi.execute(markdown, title);
      setState({ isCleaning: false, diffResult: result, error: null });
      return result;
    } catch (err: any) {
      setState({ isCleaning: false, diffResult: null, error: err.message || 'Failed to clean with AI' });
      return null;
    }
  }, [cleanupWithAi]);

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
  };
}

