import type { CollectionMaterial } from '../../domain/collections/models/CollectionMaterial';
import type { CollectionMaterialRepository } from '../../domain/collections/repositories/CollectionMaterialRepository';

export class AddMaterialToCollectionUseCase {
    private readonly links: CollectionMaterialRepository;

    constructor(links: CollectionMaterialRepository) {
        this.links = links;
    }

    async execute(collectionId: string, materialId: string): Promise<CollectionMaterial> {
        const existing = await this.links.getByCollectionId(collectionId);
        if (existing.some((l) => l.materialId === materialId)) {
            throw new Error(`Material "${materialId}" is already in collection "${collectionId}"`);
        }
        const order = existing.reduce((max, l) => Math.max(max, l.order), -1) + 1;
        return this.links.add(collectionId, materialId, order);
    }
}
