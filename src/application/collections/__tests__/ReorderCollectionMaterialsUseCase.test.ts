import { describe, expect, it, vi } from 'vitest';
import { ReorderCollectionMaterialsUseCase } from '../ReorderCollectionMaterialsUseCase';
import type { CollectionMaterialRepository } from '../../../domain/collections/repositories/CollectionMaterialRepository';

describe('ReorderCollectionMaterialsUseCase', () => {
    it('delegates reorder to the repository', async () => {
        const mockLinks: CollectionMaterialRepository = {
            getByCollectionId: vi.fn(),
            getByMaterialId: vi.fn(),
            add: vi.fn(),
            remove: vi.fn(),
            reorder: vi.fn().mockResolvedValue(undefined),
            removeByCollectionId: vi.fn(),
            removeByMaterialId: vi.fn(),
        };

        await new ReorderCollectionMaterialsUseCase(mockLinks).execute('c-1', ['m-2', 'm-1']);

        expect(mockLinks.reorder).toHaveBeenCalledWith('c-1', ['m-2', 'm-1']);
    });
});
