import { describe, expect, it, vi } from 'vitest';
import { CreateTermUseCase } from '../CreateTermUseCase';
import type { TermRepository, CreateTermInput } from '../../../../domain/library/TermRepository';
import type { Term } from '../../../../domain/library/Term';

describe('CreateTermUseCase', () => {
    const mockTerm: Term = {
        id: 'term-new',
        title: 'Quarter 1',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('creates and returns a new term', async () => {
        const mockRepo: TermRepository = {
            createTerm: vi.fn().mockResolvedValue(mockTerm),
            getTerms: vi.fn(),
            getTermById: vi.fn(),
            updateTerm: vi.fn(),
            deleteTerm: vi.fn(),
            upsertTerms: vi.fn(),
        };

        const useCase = new CreateTermUseCase(mockRepo);
        const input: CreateTermInput = { title: 'Quarter 1' };

        const result = await useCase.execute(input);

        expect(mockRepo.createTerm).toHaveBeenCalledWith(input);
        expect(result).toEqual(mockTerm);
    });
});
