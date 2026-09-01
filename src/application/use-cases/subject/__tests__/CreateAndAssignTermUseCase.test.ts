import { describe, expect, it, vi } from 'vitest';
import { CreateAndAssignTermUseCase } from '../CreateAndAssignTermUseCase';
import type { TermService, CreateAndAssignTermResult } from '../../../../domain/library/TermService';

describe('CreateAndAssignTermUseCase', () => {
    it('creates term and assigns to subject via TermService', async () => {
        const mockResult: CreateAndAssignTermResult = {
            term: {
                id: 'term-new',
                title: 'Midterms',
                createdAt: '2026-09-01T00:00:00.000Z',
                updatedAt: '2026-09-01T00:00:00.000Z',
            },
            subjectTerm: {
                subjectId: 'sub-1',
                termId: 'term-new',
                order: 2,
            },
        };

        const mockService: TermService = {
            createAndAssignTerm: vi.fn().mockResolvedValue(mockResult),
        };

        const useCase = new CreateAndAssignTermUseCase(mockService);
        const result = await useCase.execute('sub-1', 'Midterms');

        expect(mockService.createAndAssignTerm).toHaveBeenCalledWith('sub-1', 'Midterms');
        expect(result).toEqual(mockResult);
    });
});
