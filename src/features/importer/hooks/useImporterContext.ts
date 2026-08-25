import { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import { ExtractContentUseCase } from '../../../application/use-cases/importer/ExtractContentUseCase';
import { CommitImportUseCase } from '../../../application/use-cases/importer/CommitImportUseCase';
import { CleanupImportWithAiUseCase } from '../../../application/use-cases/importer/CleanupImportWithAiUseCase';
import type { ImporterRegistry } from '../../../domain/importer/ContentImporter';
import type { ImportAssetRepository } from '../../../domain/importer/ImportAssetRepository';

export function useImporterContext() {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error('useImporterContext must be used within ApplicationContext provider');
  }

  return useMemo(() => {
    const useCases = context.useCases as any;
    if (useCases.importer) {
      return useCases.importer as {
        extractContent: ExtractContentUseCase;
        commitImport: CommitImportUseCase;
        cleanupWithAi: CleanupImportWithAiUseCase;
      };
    }

    const dummyRegistry: ImporterRegistry = {
      resolve: () => undefined,
      importers: [],
      acceptedTypes: '',
    };
    
    const dummyImportAssetRepo: ImportAssetRepository = {
      put: async () => {},
      get: async () => undefined,
      delete: async () => {},
    } as any;

    return {
      extractContent: new ExtractContentUseCase(dummyRegistry),
      commitImport: new CommitImportUseCase(
        context.repositories.libraryRepository,
        context.repositories.documentContentRepository,
        (context.repositories as any).importAssetRepository || dummyImportAssetRepo
      ),
      cleanupWithAi: new CleanupImportWithAiUseCase(context.repositories.aiService),
    };
  }, [context]);
}

