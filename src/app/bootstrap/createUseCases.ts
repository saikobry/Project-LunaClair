import { createQuizUseCases } from './use-cases/createQuizUseCases';
import { createLibraryUseCases } from './use-cases/createLibraryUseCases';
import { createReaderUseCases } from './use-cases/createReaderUseCases';
import { createAnalyticsUseCases } from './use-cases/createAnalyticsUseCases';
import { createAiUseCases } from './use-cases/createAiUseCases';
import { createImporterUseCases } from './use-cases/createImporterUseCases';
import { createPackageUseCases } from './use-cases/createPackageUseCases';
import { createSyncUseCases } from './use-cases/createSyncUseCases';
import type { Repositories } from './createRepositories';

/**
 * Root composition factory for application use cases.
 * Delegates domain slice construction to dedicated modular factories.
 */
export function createUseCases(repositories: Repositories) {
    const quizSlices = createQuizUseCases(repositories);
    const librarySlices = createLibraryUseCases(repositories);
    const readerSlices = createReaderUseCases(repositories);
    const aiSlices = createAiUseCases(repositories);
    const packageSlices = createPackageUseCases(repositories);

    return {
        flashcards: quizSlices.flashcards,
        quiz: quizSlices.quiz,
        quizManagement: quizSlices.quizManagement,
        library: librarySlices.library,
        subject: librarySlices.subject,
        reader: readerSlices.reader,
        content: readerSlices.content,
        analytics: createAnalyticsUseCases(repositories),
        ai: aiSlices.ai,
        generator: aiSlices.generator,
        importer: createImporterUseCases(repositories),
        package: packageSlices.package,
        sharing: packageSlices.sharing,
        sync: createSyncUseCases(repositories),
    };
}

export type UseCases = ReturnType<typeof createUseCases>;
