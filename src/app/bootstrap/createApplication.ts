import { createRepositories, type Repositories } from './createRepositories';
import { createUseCases, type UseCases } from './createUseCases';

export interface Application { repositories: Repositories; useCases: UseCases; }

export function createApplication(): Application {
    const repositories = createRepositories();
    return { repositories, useCases: createUseCases(repositories) };
}
