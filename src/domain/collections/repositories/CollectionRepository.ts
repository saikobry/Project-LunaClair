import type { Collection, UpdateCollectionInput } from '../models/Collection';

export interface CollectionRepository {
    getAll(signal?: AbortSignal): Promise<Collection[]>;
    getById(id: string, signal?: AbortSignal): Promise<Collection | null>;
    create(collection: Collection): Promise<Collection>;
    update(id: string, patch: UpdateCollectionInput): Promise<Collection>;
    delete(id: string): Promise<void>;
    reorder(orderedIds: string[]): Promise<void>;
}
