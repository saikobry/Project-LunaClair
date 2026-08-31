import { ExtractContentUseCase } from '../../../application/use-cases/importer/ExtractContentUseCase';
import { CommitImportUseCase } from '../../../application/use-cases/importer/CommitImportUseCase';
import { CleanupImportWithAiUseCase } from '../../../application/use-cases/importer/CleanupImportWithAiUseCase';
import type { Infrastructure } from '../createInfrastructure';

export function createImporterUseCases(infrastructure: Infrastructure) {
    const { repositories, services, importerRegistry } = infrastructure;

    return {
        extractContent: new ExtractContentUseCase(importerRegistry),
        commitImport: new CommitImportUseCase(
            repositories.library,
            repositories.documentContent,
            repositories.importAsset,
        ),
        cleanupWithAi: new CleanupImportWithAiUseCase(services.ai),
    };
}
