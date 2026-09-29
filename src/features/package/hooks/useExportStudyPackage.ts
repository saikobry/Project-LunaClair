import { useState, useCallback } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../shared/utils/contextGuard';
import { useToast } from '../../../app/providers/ToastContext';
import { serializePackageToBlob } from '../../../domain/package/engines/StudyPackageSerializer';
import { validateStudyPackage } from '../../../domain/package/engines/validateStudyPackage';
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

        // The local export gate: the same validation publication runs, for the same reason and at
        // the same place in the flow. An `.lcpack` is a share someone else has to be able to clone,
        // and materialization copies each question's payload verbatim, so a question whose stored
        // payload is malformed would otherwise be written back out just as malformed. The
        // throw is reported through this hook's existing error channel, which is where "you cannot
        // export this" already belongs.
        const validation = validateStudyPackage(pkg);
        if (!validation.isValid) {
          throw new Error(
            `Cannot export this material: ${validation.errors[0] ?? 'its study package failed validation.'}`,
          );
        }

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
