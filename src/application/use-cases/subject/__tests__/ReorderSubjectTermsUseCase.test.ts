import { describe, expect, it, vi } from 'vitest';
import { ReorderSubjectTermsUseCase } from '../ReorderSubjectTermsUseCase';
import type { SubjectTermRepository } from '../../../../domain/library/repositories/SubjectTermRepository';
import type { Term } from '../../../../domain/library/models/Term';

describe('ReorderSubjectTermsUseCase', () => {
    const term1: Term = {
        id: 'term-1',
        title: 'Prelim',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const term2: Term = {
        id: 'term-2',
        title: 'Midterm',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('reorders terms when input contains all linked terms exactly once', async () => {
        const mockSubjectTerms: SubjectTermRepository = {
            getTermsBySubject: vi.fn().mockResolvedValue([term1, term2]),
            reorderTerms: vi.fn().mockResolvedValue(undefined),
            getSubjectTermViews: vi.fn(),
            getSubjectIdsByTerm: vi.fn(),
            syncTerms: vi.fn(),
            addTerm: vi.fn(),
            removeTerm: vi.fn(),
            hasTerm: vi.fn(),
        };

        const useCase = new ReorderSubjectTermsUseCase(mockSubjectTerms);
        await useCase.execute('sub-1', ['term-2', 'term-1']);

        expect(mockSubjectTerms.reorderTerms).toHaveBeenCalledWith('sub-1', ['term-2', 'term-1']);
    });

    it('rejects when ordered list is missing a term or has mismatched length', async () => {
        const mockSubjectTerms: SubjectTermRepository = {
            getTermsBySubject: vi.fn().mockResolvedValue([term1, term2]),
            reorderTerms: vi.fn(),
            getSubjectTermViews: vi.fn(),
            getSubjectIdsByTerm: vi.fn(),
            syncTerms: vi.fn(),
            addTerm: vi.fn(),
            removeTerm: vi.fn(),
            hasTerm: vi.fn(),
        };

        const useCase = new ReorderSubjectTermsUseCase(mockSubjectTerms);

        await expect(
            useCase.execute('sub-1', ['term-1']), // missing term-2
        ).rejects.toThrow('Ordered term list must contain every subject term exactly once');

        expect(mockSubjectTerms.reorderTerms).not.toHaveBeenCalled();
    });
});
