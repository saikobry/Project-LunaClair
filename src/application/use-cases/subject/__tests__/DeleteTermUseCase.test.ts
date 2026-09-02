import { describe, expect, it, vi } from 'vitest';
import { DeleteTermUseCase } from '../DeleteTermUseCase';
import type { TermRepository } from '../../../../domain/library/repositories/TermRepository';

describe('DeleteTermUseCase', () => {
    it('delegates deletion to TermRepository', async () => {
        const mockRepo: TermRepository = {
            deleteTerm: vi.fn().mockResolvedValue(undefined),
            getTerms: vi.fn(),
            getTermById: vi.fn(),
            createTerm: vi.fn(),
            updateTerm: vi.fn(),
            upsertTerms: vi.fn(),
        };

        const useCase = new DeleteTermUseCase(mockRepo);
        await useCase.execute('term-1');

        expect(mockRepo.deleteTerm).toHaveBeenCalledWith('term-1');
    });
});
