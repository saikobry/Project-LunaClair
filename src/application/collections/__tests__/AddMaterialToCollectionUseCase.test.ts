import { describe, expect, it, vi } from 'vitest';
import { AddMaterialToCollectionUseCase } from '../AddMaterialToCollectionUseCase';
import type { CollectionMaterialRepository } from '../../../domain/collections/repositories/CollectionMaterialRepository';

describe('AddMaterialToCollectionUseCase', () => {
    it('auto-calculates max order + 1', async () => {
        const mockLinks: CollectionMaterialRepository = {
            getByCollectionId: vi.fn().mockResolvedValue([
                { collectionId: 'c-1', materialId: 'm-1', order: 0, addedAt: '2026-09-01T00:00:00.000Z' },
            ]),
            getByMaterialId: vi.fn(),
            add: vi.fn().mockResolvedValue({ collectionId: 'c-1', materialId: 'm-2', order: 1, addedAt: '2026-09-01T00:00:00.000Z' }),
            remove: vi.fn(),
            reorder: vi.fn(),
            removeByCollectionId: vi.fn(),
            removeByMaterialId: vi.fn(),
        };

        const result = await new AddMaterialToCollectionUseCase(mockLinks).execute('c-1', 'm-2');

        expect(mockLinks.add).toHaveBeenCalledWith('c-1', 'm-2', 1);
        expect(result.order).toBe(1);
    });

    it('rejects duplicate membership', async () => {
        const mockLinks: CollectionMaterialRepository = {
            getByCollectionId: vi.fn().mockResolvedValue([
                { collectionId: 'c-1', materialId: 'm-1', order: 0, addedAt: '2026-09-01T00:00:00.000Z' },
            ]),
            getByMaterialId: vi.fn(),
            add: vi.fn(),
            remove: vi.fn(),
            reorder: vi.fn(),
            removeByCollectionId: vi.fn(),
            removeByMaterialId: vi.fn(),
        };

        await expect(new AddMaterialToCollectionUseCase(mockLinks).execute('c-1', 'm-1')).rejects.toThrow(
            'Material "m-1" is already in collection "c-1"',
        );
        expect(mockLinks.add).not.toHaveBeenCalled();
    });
});
