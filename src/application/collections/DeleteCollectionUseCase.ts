import type { CollectionRepository } from '../../domain/collections/repositories/CollectionRepository';
import type { CollectionMaterialRepository } from '../../domain/collections/repositories/CollectionMaterialRepository';

export class DeleteCollectionUseCase {
    private readonly collections: CollectionRepository;
    private readonly links: CollectionMaterialRepository;

    constructor(collections: CollectionRepository, links: CollectionMaterialRepository) {
        this.collections = collections;
        this.links = links;
    }

    async execute(id: string): Promise<void> {
        await this.collections.delete(id);
        await this.links.removeByCollectionId(id);
    }
}
