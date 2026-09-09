import type { Collection, UpdateCollectionInput } from '../../domain/collections/models/Collection';
import type { CollectionRepository } from '../../domain/collections/repositories/CollectionRepository';

export class UpdateCollectionUseCase {
    private readonly collections: CollectionRepository;

    constructor(collections: CollectionRepository) {
        this.collections = collections;
    }

    execute(id: string, input: UpdateCollectionInput): Promise<Collection> {
        if (input.title !== undefined && input.title.trim().length === 0) {
            throw new Error('UpdateCollection: title must not be empty');
        }
        return this.collections.update(id, input);
    }
}
