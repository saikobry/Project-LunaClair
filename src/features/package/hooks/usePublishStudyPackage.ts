import { useState, useCallback } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../shared/utils/contextGuard';
import { useToast } from '../../../app/providers/ToastContext';
import type {
  PublishShareResult,
  ShareAccessType,
} from '../../../domain/sharing/sharing.types';

export interface PublishOptions {
  accessType?: ShareAccessType;
  passcode?: string;
  expiresAt?: string;
}

export interface UsePublishStudyPackageOptions {
  onSuccess?: (result: PublishShareResult) => void;
  onError?: (error: Error) => void;
}

export function usePublishStudyPackage(options?: UsePublishStudyPackageOptions) {
  const context = useContextOrThrow(ApplicationContext, 'usePublishStudyPackage');
  const { showToast } = useToast();
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishShareResult | null>(null);

  const reset = useCallback(() => {
    setPublishResult(null);
  }, []);

  const publish = useCallback(
    async (
      materialId: string,
      publishOptions?: PublishOptions,
    ): Promise<PublishShareResult> => {
      if (isPublishing) {
        throw new Error('Publication already in progress');
      }
      setIsPublishing(true);
      try {
        const result = await context.useCases.sharing.publishStudyPackage.execute({
          materialId,
          accessType: publishOptions?.accessType ?? 'public',
          passcode: publishOptions?.passcode,
          expiresAt: publishOptions?.expiresAt,
        });

        setPublishResult(result);
        showToast(`Published "${result.title}" to Cloud`, {
          intent: 'success',
        });
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        showToast(error.message || 'Failed to publish study package', {
          intent: 'error',
        });
        options?.onError?.(error);
        throw error;
      } finally {
        setIsPublishing(false);
      }
    },
    [context, isPublishing, showToast, options],
  );

  return {
    publish,
    isPublishing,
    publishResult,
    reset,
  };
}
