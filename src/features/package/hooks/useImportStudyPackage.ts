import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { useToast } from '../../../app/providers/ToastContext';
import { useContextOrThrow } from '../../../shared/utils/contextGuard';
import { parsePackageFromBlob } from '../../../shared/utils/studyPackageParser';
import type { StudyPackage } from '../../../domain/package/package.types';
import { validateStudyPackage } from '../../../domain/package/validateStudyPackage';
import type { ImportOptions } from '../components/StudyPackagePreviewModal';

export interface UseImportStudyPackageResult {
  stagedPackage: StudyPackage | null;
  isPreviewOpen: boolean;
  isImporting: boolean;
  errorMessage: string | null;
  stagePackageFromFile: (file: Blob | File) => Promise<boolean>;
  closePreview: () => void;
  confirmImport: (options?: ImportOptions) => Promise<void>;
}

/**
 * Hook to coordinate file parsing, domain validation, pre-import staging,
 * and atomic library import of StudyPackage (.lcpack / JSON) bundles.
 */
export function useImportStudyPackage(): UseImportStudyPackageResult {
  const context = useContextOrThrow(ApplicationContext, 'useImportStudyPackage');
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [stagedPackage, setStagedPackage] = useState<StudyPackage | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stagePackageFromFile = useCallback(
    async (file: Blob | File): Promise<boolean> => {
      setErrorMessage(null);
      try {
        const raw = await parsePackageFromBlob(file);
        const validation = validateStudyPackage(raw);

        if (!validation.isValid) {
          const detail = `Invalid study package: ${validation.errors.join('; ')}`;
          const firstError = validation.errors[0] || 'Unknown validation error';
          setErrorMessage(detail);
          showToast(`Invalid study package: ${firstError}`, { intent: 'error' });
          return false;
        }

        setStagedPackage(raw as StudyPackage);
        setIsPreviewOpen(true);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to parse study package file.';
        setErrorMessage(message);
        showToast(message, { intent: 'error' });
        return false;
      }
    },
    [showToast],
  );

  const closePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setStagedPackage(null);
    setErrorMessage(null);
  }, []);

  const confirmImport = useCallback(
    async (options: ImportOptions = {}): Promise<void> => {
      if (!stagedPackage) {
        return;
      }

      setIsImporting(true);
      try {
        await context.useCases.package.importStudyPackage.execute({
          package: stagedPackage,
          targetSubjectId: options.subjectId,
          targetTermId: options.termId,
        });

        // Invalidate all query namespaces affected by importing materials, quizzes, and questions
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['catalog'] }),
          queryClient.invalidateQueries({ queryKey: ['materials'] }),
          queryClient.invalidateQueries({ queryKey: ['quizzes'] }),
          queryClient.invalidateQueries({ queryKey: ['questions'] }),
          queryClient.invalidateQueries({ queryKey: ['library'] }),
          queryClient.invalidateQueries({ queryKey: ['assessment'] }),
        ]);

        showToast('Study package imported successfully', { intent: 'success' });
        setIsPreviewOpen(false);
        setStagedPackage(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to import study package.';
        showToast(message, { intent: 'error' });
        throw error;
      } finally {
        setIsImporting(false);
      }
    },
    [stagedPackage, context, queryClient, showToast],
  );

  return {
    stagedPackage,
    isPreviewOpen,
    isImporting,
    errorMessage,
    stagePackageFromFile,
    closePreview,
    confirmImport,
  };
}
