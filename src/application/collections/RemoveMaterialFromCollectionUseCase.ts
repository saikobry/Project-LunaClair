import type { CollectionMaterialRepository } from '../../domain/collections/repositories/CollectionMaterialRepository';

export class RemoveMaterialFromCollectionUseCase {
    private readonly links: CollectionMaterialRepository;

    constructor(links: CollectionMaterialRepository) {
        this.links = links;
    }

    execute(collectionId: string, materialId: string): Promise<void> {
        return this.links.remove(collectionId, materialId);
    }
}
