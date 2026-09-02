import { describe, expect, it, vi } from 'vitest';
import { SyncSubjectTermsUseCase } from '../SyncSubjectTermsUseCase';
import type { SubjectTermRepository } from '../../../../domain/library/repositories/SubjectTermRepository';
import type { TermRepository } from '../../../../domain/library/repositories/TermRepository';
import type { Term } from '../../../../domain/library/models/Term';

describe('SyncSubjectTermsUseCase', () => {
    const knownTerm1: Term = {
        id: 'term-1',
        title: 'Prelim',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const knownTerm2: Term = {
        id: 'term-2',
        title: 'Midterm',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('syncs term associations when all terms exist', async () => {
        const mockSubjectTerms: SubjectTermRepository = {
            syncTerms: vi.fn().mockResolvedValue(undefined),
            getTermsBySubject: vi.fn(),
            getSubjectTermViews: vi.fn(),
            getSubjectIdsByTerm: vi.fn(),
            reorderTerms: vi.fn(),
            addTerm: vi.fn(),
            removeTerm: vi.fn(),
            hasTerm: vi.fn(),
        };

        const mockTerms: TermRepository = {
            getTerms: vi.fn().mockResolvedValue([knownTerm1, knownTerm2]),
            getTermById: vi.fn(),
            createTerm: vi.fn(),
            updateTerm: vi.fn(),
            deleteTerm: vi.fn(),
            upsertTerms: vi.fn(),
        };

        const useCase = new SyncSubjectTermsUseCase(mockSubjectTerms, mockTerms);
        await useCase.execute('sub-1', ['term-1', 'term-2']);

        expect(mockSubjectTerms.syncTerms).toHaveBeenCalledWith('sub-1', ['term-1', 'term-2']);
    });

    it('rejects when syncing an unknown / unpersisted term id', async () => {
        const mockSubjectTerms: SubjectTermRepository = {
            syncTerms: vi.fn(),
            getTermsBySubject: vi.fn(),
            getSubjectTermViews: vi.fn(),
            getSubjectIdsByTerm: vi.fn(),
            reorderTerms: vi.fn(),
            addTerm: vi.fn(),
            removeTerm: vi.fn(),
            hasTerm: vi.fn(),
        };

        const mockTerms: TermRepository = {
            getTerms: vi.fn().mockResolvedValue([knownTerm1]), // only term-1 exists
            getTermById: vi.fn(),
            createTerm: vi.fn(),
            updateTerm: vi.fn(),
            deleteTerm: vi.fn(),
            upsertTerms: vi.fn(),
        };

        const useCase = new SyncSubjectTermsUseCase(mockSubjectTerms, mockTerms);

        await expect(
            useCase.execute('sub-1', ['term-1', 'term-nonexistent']),
        ).rejects.toThrow('Cannot sync subject terms: one or more terms do not exist');

        expect(mockSubjectTerms.syncTerms).not.toHaveBeenCalled();
    });
});
