import type { Infrastructure, Repositories } from './createInfrastructure';
import { createInfrastructure } from './createInfrastructure';
import type { UseCases } from './createUseCases';
import { createUseCases } from './createUseCases';

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
 */
export function createApplication(): Application {
    const infrastructure = createInfrastructure();

    return {
        repositories: infrastructure.repositories,
        useCases: createUseCases(infrastructure),
        infrastructure,
    };
}
