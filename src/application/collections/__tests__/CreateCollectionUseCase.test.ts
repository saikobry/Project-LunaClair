import { describe, expect, it, vi } from 'vitest';
import { CreateCollectionUseCase } from '../CreateCollectionUseCase';
import type { CollectionRepository } from '../../../domain/collections/repositories/CollectionRepository';

describe('CreateCollectionUseCase', () => {
    it('assigns max order + 1 and creates the collection', async () => {
        const mockRepo: CollectionRepository = {
            getAll: vi.fn().mockResolvedValue([
                { id: 'c-1', title: 'A', order: 0, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
                { id: 'c-2', title: 'B', order: 1, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
            ]),
            getById: vi.fn(),
            create: vi.fn().mockImplementation((c) => Promise.resolve(c)),
            update: vi.fn(),
            delete: vi.fn(),
            reorder: vi.fn(),
        };

        const result = await new CreateCollectionUseCase(mockRepo).execute({ title: ' New ' });

        expect(result.title).toBe('New');
        expect(result.order).toBe(2);
        expect(mockRepo.create).toHaveBeenCalledOnce();
    });

    it('rejects empty titles', async () => {
        const mockRepo: CollectionRepository = {
            getAll: vi.fn().mockResolvedValue([]),
            getById: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            reorder: vi.fn(),
        };
        await expect(new CreateCollectionUseCase(mockRepo).execute({ title: '   ' })).rejects.toThrow(
            'CreateCollection: title must not be empty',
        );
    });
});
