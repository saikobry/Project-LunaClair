import { createQuizUseCases } from './use-cases/createQuizUseCases';
import { createLibraryUseCases } from './use-cases/createLibraryUseCases';
import { createReaderUseCases } from './use-cases/createReaderUseCases';
import { createAnalyticsUseCases } from './use-cases/createAnalyticsUseCases';
import { createAiUseCases } from './use-cases/createAiUseCases';
import { createImporterUseCases } from './use-cases/createImporterUseCases';
import { createPackageUseCases } from './use-cases/createPackageUseCases';
import { createSyncUseCases } from './use-cases/createSyncUseCases';
import { createCollectionUseCases } from './use-cases/createCollectionUseCases';
import type { Infrastructure } from './createInfrastructure';
import {
    noopAnalyticsCacheInvalidator,
    type AnalyticsCacheInvalidator,
} from './analyticsInvalidation';

/**
 * Root composition factory for application use cases.
 * Delegates domain slice construction to dedicated modular factories.
 *
 * `invalidateAnalytics` reaches the two slices that write questions: the
 * question repository is decorated in `createInfrastructure`, and the quiz
 * canvas save is decorated here. See `analyticsInvalidation.ts` for why the
 * coordination lives at this boundary rather than in a feature hook.
 */
export function createUseCases(
    infrastructure: Infrastructure,
    invalidateAnalytics: AnalyticsCacheInvalidator = noopAnalyticsCacheInvalidator,
) {
    const quizSlices = createQuizUseCases(infrastructure, invalidateAnalytics);
    const librarySlices = createLibraryUseCases(infrastructure);
    const readerSlices = createReaderUseCases(infrastructure);
    const aiSlices = createAiUseCases(infrastructure);
    const packageSlices = createPackageUseCases(infrastructure);

    return {
        flashcards: quizSlices.flashcards,
        quiz: quizSlices.quiz,
        quizManagement: quizSlices.quizManagement,
        library: librarySlices.library,
        reader: readerSlices.reader,
        content: readerSlices.content,
        analytics: createAnalyticsUseCases(infrastructure),
        ai: aiSlices.ai,
        generator: aiSlices.generator,
        importer: createImporterUseCases(infrastructure),
        package: packageSlices.package,
        sharing: packageSlices.sharing,
        sync: createSyncUseCases(infrastructure),
        collections: createCollectionUseCases(infrastructure).collections,
    };
}

export type UseCases = ReturnType<typeof createUseCases>;
