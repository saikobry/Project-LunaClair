import type { Collection, CreateCollectionInput } from '../../domain/collections/models/Collection';
import type { CollectionRepository } from '../../domain/collections/repositories/CollectionRepository';

function generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15);
}

export class CreateCollectionUseCase {
    private readonly collections: CollectionRepository;

    constructor(collections: CollectionRepository) {
        this.collections = collections;
    }

    async execute(input: CreateCollectionInput): Promise<Collection> {
        const title = input.title.trim();
        if (title.length === 0) {
            throw new Error('CreateCollection: title must not be empty');
        }

        const existing = await this.collections.getAll();
        const order = existing.reduce((max, c) => Math.max(max, c.order), -1) + 1;

        const now = new Date().toISOString();
        const collection: Collection = {
            id: generateId(),
            title,
            description: input.description,
            icon: input.icon,
            color: input.color,
            order,
            createdAt: now,
            updatedAt: now,
        };
        return this.collections.create(collection);
    }
}
