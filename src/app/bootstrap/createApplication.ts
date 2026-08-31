import { createInfrastructure, type Infrastructure } from './createInfrastructure';
import { createUseCases, type UseCases } from './createUseCases';

export interface Application {
    infrastructure: Infrastructure;
    useCases: UseCases;
}

/**
 * Composition Root of Project LunaClair.
 *
 * Instantiates the infrastructure layer via `createInfrastructure()` and
 * passes it into `createUseCases()` to build the complete application graph.
 */
export function createApplication(): Application {
    const infrastructure = createInfrastructure();
    return {
        infrastructure,
        useCases: createUseCases(infrastructure),
    };
}
