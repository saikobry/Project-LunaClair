import { useState, useCallback } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../shared/utils/contextGuard';
import { useToast } from '../../../app/providers/ToastContext';
import { serializePackageToBlob } from '../../../application';
import { sanitizeFilename, triggerBlobDownload } from '../../../shared/utils/fileDownload';

export interface UseExportStudyPackageOptions {
  onSuccess?: (title: string) => void;
  onError?: (error: Error) => void;
}

export function useExportStudyPackage(options?: UseExportStudyPackageOptions) {
  const context = useContextOrThrow(ApplicationContext, 'useExportStudyPackage');
  const { showToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const exportPackage = useCallback(
    async (materialId: string) => {
      if (isExporting) return;
      setIsExporting(true);
      try {
        const pkg = await context.useCases.package.materializeStudyPackage.execute({
          materialId,
        });

        const blob = serializePackageToBlob(pkg, true);
        const title = pkg.metadata?.title || 'study-package';
        const safeTitle = sanitizeFilename(title);
        const filename = `${safeTitle}.lcpack`;

        triggerBlobDownload(blob, filename);

        showToast(`Exported "${title}" as .lcpack`, {
          intent: 'success',
        });

        options?.onSuccess?.(title);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        showToast(error.message || 'Failed to export study package', {
          intent: 'error',
        });
        options?.onError?.(error);
      } finally {
        setIsExporting(false);
      }
    },
    [context, isExporting, showToast, options],
  );

  return {
    exportPackage,
    isExporting,
  };
}
