import { describe, expect, it, vi } from 'vitest';
import { DeleteCollectionUseCase } from '../DeleteCollectionUseCase';
import type { CollectionRepository } from '../../../domain/collections/repositories/CollectionRepository';
import type { CollectionMaterialRepository } from '../../../domain/collections/repositories/CollectionMaterialRepository';

describe('DeleteCollectionUseCase', () => {
    it('deletes the collection and removes its junction records', async () => {
        const mockCollections: CollectionRepository = {
            getAll: vi.fn(),
            getById: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn().mockResolvedValue(undefined),
            reorder: vi.fn(),
        };
        const mockLinks: CollectionMaterialRepository = {
            getByCollectionId: vi.fn(),
            getByMaterialId: vi.fn(),
            add: vi.fn(),
            remove: vi.fn(),
            reorder: vi.fn(),
            removeByCollectionId: vi.fn().mockResolvedValue(undefined),
            removeByMaterialId: vi.fn(),
        };

        await new DeleteCollectionUseCase(mockCollections, mockLinks).execute('c-1');

        expect(mockCollections.delete).toHaveBeenCalledWith('c-1');
        expect(mockLinks.removeByCollectionId).toHaveBeenCalledWith('c-1');
    });
});
