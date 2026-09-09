import { describe, expect, it, vi } from 'vitest';
import { UpdateCollectionUseCase } from '../UpdateCollectionUseCase';
import type { CollectionRepository } from '../../../domain/collections/repositories/CollectionRepository';

describe('UpdateCollectionUseCase', () => {
    it('delegates patches to the repository', async () => {
        const updated = { id: 'c-1', title: 'Renamed', order: 0, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' };
        const mockRepo: CollectionRepository = {
            getAll: vi.fn(),
            getById: vi.fn(),
            create: vi.fn(),
            update: vi.fn().mockResolvedValue(updated),
            delete: vi.fn(),
            reorder: vi.fn(),
        };

        const result = await new UpdateCollectionUseCase(mockRepo).execute('c-1', { title: 'Renamed' });

        expect(mockRepo.update).toHaveBeenCalledWith('c-1', { title: 'Renamed' });
        expect(result).toEqual(updated);
    });

    it('rejects empty titles', () => {
        const mockRepo = { update: vi.fn() } as unknown as CollectionRepository;
        expect(() => new UpdateCollectionUseCase(mockRepo).execute('c-1', { title: '  ' })).toThrow(
            'UpdateCollection: title must not be empty',
        );
    });
});
