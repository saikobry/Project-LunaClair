import { CreateMaterialUseCase } from '../../../application/use-cases/library/CreateMaterialUseCase';
import { UpdateMaterialUseCase } from '../../../application/use-cases/library/UpdateMaterialUseCase';
import { DeleteMaterialUseCase } from '../../../application/use-cases/library/DeleteMaterialUseCase';
import { RemoveImportedMaterialUseCase } from '../../../application/use-cases/library/RemoveImportedMaterialUseCase';
import { TouchMaterialUseCase } from '../../../application/use-cases/library/TouchMaterialUseCase';
import type { Infrastructure } from '../createInfrastructure';

export function createLibraryUseCases(infrastructure: Infrastructure) {
    const { repositories, services } = infrastructure;

    return {
        library: {
            createMaterial: new CreateMaterialUseCase(repositories.library),
            updateMaterial: new UpdateMaterialUseCase(repositories.library),
            deleteMaterial: new DeleteMaterialUseCase(repositories.library),
            touchMaterial: new TouchMaterialUseCase(repositories.library),
            removeImportedMaterial: new RemoveImportedMaterialUseCase(services.libraryImport),
        },
    };
}
