import { ExtractContentUseCase } from '../../../application/use-cases/importer/ExtractContentUseCase';
import { CommitImportUseCase } from '../../../application/use-cases/importer/CommitImportUseCase';
import { CleanupImportWithAiUseCase } from '../../../application/use-cases/importer/CleanupImportWithAiUseCase';
import type { Repositories } from '../createRepositories';

export function createImporterUseCases(repositories: Repositories) {
    return {
        extractContent: new ExtractContentUseCase(repositories.importerRegistry),
        commitImport: new CommitImportUseCase(
            repositories.libraryRepository,
            repositories.documentContentRepository,
            repositories.importAssetRepository,
        ),
        cleanupWithAi: new CleanupImportWithAiUseCase(repositories.aiService),
    };
}
