import { CreateMaterialUseCase } from '../../../application/use-cases/library/CreateMaterialUseCase';
import { UpdateMaterialUseCase } from '../../../application/use-cases/library/UpdateMaterialUseCase';
import { RemoveMaterialUseCase } from '../../../application/use-cases/library/RemoveMaterialUseCase';
import { TouchMaterialUseCase } from '../../../application/use-cases/library/TouchMaterialUseCase';
import type { Infrastructure } from '../createInfrastructure';

export function createLibraryUseCases(infrastructure: Infrastructure) {
    const { repositories, services } = infrastructure;

    return {
        library: {
            createMaterial: new CreateMaterialUseCase(repositories.library),
            updateMaterial: new UpdateMaterialUseCase(repositories.library),
            touchMaterial: new TouchMaterialUseCase(repositories.library),
            removeMaterial: new RemoveMaterialUseCase(services.libraryImport),
        },
    };
}
