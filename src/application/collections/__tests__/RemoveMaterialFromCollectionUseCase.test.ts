import { describe, expect, it, vi } from 'vitest';
import { RemoveMaterialFromCollectionUseCase } from '../RemoveMaterialFromCollectionUseCase';
import type { CollectionMaterialRepository } from '../../../domain/collections/repositories/CollectionMaterialRepository';

describe('RemoveMaterialFromCollectionUseCase', () => {
    it('delegates removal to the repository', async () => {
        const mockLinks: CollectionMaterialRepository = {
            getByCollectionId: vi.fn(),
            getByMaterialId: vi.fn(),
            add: vi.fn(),
            remove: vi.fn().mockResolvedValue(undefined),
            reorder: vi.fn(),
            removeByCollectionId: vi.fn(),
            removeByMaterialId: vi.fn(),
        };

        await new RemoveMaterialFromCollectionUseCase(mockLinks).execute('c-1', 'm-1');

        expect(mockLinks.remove).toHaveBeenCalledWith('c-1', 'm-1');
    });
});
