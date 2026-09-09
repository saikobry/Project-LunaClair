import type { CollectionMaterialRepository } from '../../domain/collections/repositories/CollectionMaterialRepository';

export class ReorderCollectionMaterialsUseCase {
    private readonly links: CollectionMaterialRepository;

    constructor(links: CollectionMaterialRepository) {
        this.links = links;
    }

    execute(collectionId: string, orderedMaterialIds: string[]): Promise<void> {
        return this.links.reorder(collectionId, orderedMaterialIds);
    }
}
