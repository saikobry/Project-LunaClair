import { describe, expect, it, vi } from 'vitest';
import { RemoveTermFromSubjectUseCase } from '../RemoveTermFromSubjectUseCase';
import type { SubjectTermRepository } from '../../../../domain/library/repositories/SubjectTermRepository';

describe('RemoveTermFromSubjectUseCase', () => {
    it('delegates removing term from subject via SubjectTermRepository', async () => {
        const mockSubjectTerms: SubjectTermRepository = {
            removeTerm: vi.fn().mockResolvedValue(undefined),
            getTermsBySubject: vi.fn(),
            getSubjectTermViews: vi.fn(),
            getSubjectIdsByTerm: vi.fn(),
            syncTerms: vi.fn(),
            reorderTerms: vi.fn(),
            addTerm: vi.fn(),
            hasTerm: vi.fn(),
        };

        const useCase = new RemoveTermFromSubjectUseCase(mockSubjectTerms);
        await useCase.execute('sub-1', 'term-1');

        expect(mockSubjectTerms.removeTerm).toHaveBeenCalledWith('sub-1', 'term-1');
    });
});
