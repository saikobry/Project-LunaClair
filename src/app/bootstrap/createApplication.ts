import type { Infrastructure, Repositories } from './createInfrastructure';
import { createInfrastructure } from './createInfrastructure';
import type { UseCases } from './createUseCases';
import { createUseCases } from './createUseCases';
import {
    noopAnalyticsCacheInvalidator,
    type AnalyticsCacheInvalidator,
} from './analyticsInvalidation';

/**
 * Top-level application container exposed to the React UI via ApplicationContext.
 * Features consume capabilities directly from `repositories` (pure data access)
 * and `useCases` (application intent & state transitions).
 *
 * `infrastructure` remains available for internal bootstrap & shell-level orchestration.
 */
export interface Application {
    repositories: Repositories;
    useCases: UseCases;
    infrastructure: Infrastructure;
}

/**
 * LunaClair Composition Root.
 * Composes the entire dependency graph as stable singletons.
 *
 * `invalidateAnalytics` is the composition boundary's cross-feature cache hook:
 * it is threaded into the question repository and the quiz canvas save so a
 * question write or delete recomputes the `['analytics']` pool, without either
 * authoring feature importing the analytics feature. `ApplicationProvider`
 * binds it to the app's `QueryClient`.
 */
export function createApplication(
    invalidateAnalytics: AnalyticsCacheInvalidator = noopAnalyticsCacheInvalidator,
): Application {
    const infrastructure = createInfrastructure(invalidateAnalytics);

    return {
        repositories: infrastructure.repositories,
        useCases: createUseCases(infrastructure, invalidateAnalytics),
        infrastructure,
    };
}
