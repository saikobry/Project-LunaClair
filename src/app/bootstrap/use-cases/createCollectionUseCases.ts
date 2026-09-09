import { CreateCollectionUseCase } from '../../../application/collections/CreateCollectionUseCase';
import { UpdateCollectionUseCase } from '../../../application/collections/UpdateCollectionUseCase';
import { DeleteCollectionUseCase } from '../../../application/collections/DeleteCollectionUseCase';
import { AddMaterialToCollectionUseCase } from '../../../application/collections/AddMaterialToCollectionUseCase';
import { RemoveMaterialFromCollectionUseCase } from '../../../application/collections/RemoveMaterialFromCollectionUseCase';
import { ReorderCollectionMaterialsUseCase } from '../../../application/collections/ReorderCollectionMaterialsUseCase';
import type { Infrastructure } from '../createInfrastructure';

export function createCollectionUseCases(infrastructure: Infrastructure) {
    const { repositories } = infrastructure;

    return {
        collections: {
            createCollection: new CreateCollectionUseCase(repositories.collection),
            updateCollection: new UpdateCollectionUseCase(repositories.collection),
            deleteCollection: new DeleteCollectionUseCase(
                repositories.collection,
                repositories.collectionMaterial,
            ),
            addMaterialToCollection: new AddMaterialToCollectionUseCase(repositories.collectionMaterial),
            removeMaterialFromCollection: new RemoveMaterialFromCollectionUseCase(
                repositories.collectionMaterial,
            ),
            reorderCollectionMaterials: new ReorderCollectionMaterialsUseCase(
                repositories.collectionMaterial,
            ),
        },
    };
}
