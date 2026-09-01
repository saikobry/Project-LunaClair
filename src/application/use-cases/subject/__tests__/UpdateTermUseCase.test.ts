import { describe, expect, it, vi } from 'vitest';
import { UpdateTermUseCase } from '../UpdateTermUseCase';
import type { TermRepository, UpdateTermInput } from '../../../../domain/library/TermRepository';
import type { Term } from '../../../../domain/library/Term';

describe('UpdateTermUseCase', () => {
    const mockTerm: Term = {
        id: 'term-1',
        title: 'Prelim',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('updates term title', async () => {
        const mockRepo: TermRepository = {
            updateTerm: vi.fn().mockImplementation((id, input) =>
                Promise.resolve({
                    ...mockTerm,
                    id,
                    ...input,
                }),
            ),
            getTerms: vi.fn(),
            getTermById: vi.fn(),
            createTerm: vi.fn(),
            deleteTerm: vi.fn(),
            upsertTerms: vi.fn(),
        };

        const useCase = new UpdateTermUseCase(mockRepo);
        const input: UpdateTermInput = { title: 'First Term / Prelim' };

        const result = await useCase.execute('term-1', input);

        expect(mockRepo.updateTerm).toHaveBeenCalledWith('term-1', input);
        expect(result.title).toBe('First Term / Prelim');
    });
});
