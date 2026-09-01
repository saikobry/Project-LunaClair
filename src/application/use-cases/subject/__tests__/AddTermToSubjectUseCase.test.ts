import { describe, expect, it, vi } from 'vitest';
import { AddTermToSubjectUseCase } from '../AddTermToSubjectUseCase';
import type { SubjectTermRepository } from '../../../../domain/library/SubjectTermRepository';

describe('AddTermToSubjectUseCase', () => {
    it('delegates adding term to subject via SubjectTermRepository', async () => {
        const mockSubjectTerms: SubjectTermRepository = {
            addTerm: vi.fn().mockResolvedValue(undefined),
            getTermsBySubject: vi.fn(),
            getSubjectTermViews: vi.fn(),
            getSubjectIdsByTerm: vi.fn(),
            syncTerms: vi.fn(),
            reorderTerms: vi.fn(),
            removeTerm: vi.fn(),
            hasTerm: vi.fn(),
        };

        const useCase = new AddTermToSubjectUseCase(mockSubjectTerms);
        await useCase.execute('sub-1', 'term-1');

        expect(mockSubjectTerms.addTerm).toHaveBeenCalledWith('sub-1', 'term-1');
    });
});
