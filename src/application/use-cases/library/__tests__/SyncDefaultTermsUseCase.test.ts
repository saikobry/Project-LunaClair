import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncDefaultTermsUseCase } from '../SyncDefaultTermsUseCase';
import { CANONICAL_DEFAULT_TERMS } from '../../../../domain/library/models/term.types';
import type { TermRepository } from '../../../../domain/library/repositories/TermRepository';
import type { Term } from '../../../../domain/library/models/Term';

describe('SyncDefaultTermsUseCase', () => {
    // Fixed reference instant so upserted timestamps are deterministic.
    const FIXED_NOW = '2026-09-01T12:00:00.000Z';

    const defaultPrelim: Term = {
        id: 'prelim',
        title: 'Prelim',
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
    };

    const defaultMidterm: Term = {
        id: 'midterm',
        title: 'Midterm',
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
    };

    const defaultFinals: Term = {
        id: 'finals',
        title: 'Finals',
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW,
    };

    const createTermRepository = (localTerms: Term[] = []) => {
        const terms: TermRepository = {
            getTerms: vi.fn().mockResolvedValue(localTerms),
            getTermById: vi.fn(),
            createTerm: vi.fn(),
            updateTerm: vi.fn(),
            deleteTerm: vi.fn(),
            upsertTerms: vi.fn().mockResolvedValue(undefined),
        };

        return terms;
    };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(FIXED_NOW));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('syncs all missing default terms into local terms store', async () => {
        const terms = createTermRepository([]);
        const useCase = new SyncDefaultTermsUseCase(terms);

        const result = await useCase.execute();

        expect(terms.upsertTerms).toHaveBeenCalledWith([defaultPrelim, defaultMidterm, defaultFinals]);
        expect(result).toEqual({ synced: true, count: 3 });
    });

    it('does NOT overwrite existing local user terms (preserves user ownership invariant)', async () => {
        const customLocalPrelim: Term = {
            id: 'prelim',
            title: 'My Custom First Quarter Prelims', // User renamed term
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-15T00:00:00.000Z',
        };

        const terms = createTermRepository([customLocalPrelim]);
        const useCase = new SyncDefaultTermsUseCase(terms);

        const result = await useCase.execute();

        // Only Midterm and Finals should be upserted; custom Prelim is untouched
        expect(terms.upsertTerms).toHaveBeenCalledWith([defaultMidterm, defaultFinals]);
        expect(result).toEqual({ synced: true, count: 2 });
    });

    it('is an idempotent no-op when all default terms exist', async () => {
        const terms = createTermRepository([defaultPrelim, defaultMidterm, defaultFinals]);
        const useCase = new SyncDefaultTermsUseCase(terms);

        const result = await useCase.execute();

        expect(terms.upsertTerms).toHaveBeenCalledWith([]);
        expect(result).toEqual({ synced: true, count: 0 });
    });

    it('requires no network — canonical terms come from the bundled constant', async () => {
        expect(CANONICAL_DEFAULT_TERMS).toEqual([
            { id: 'prelim', title: 'Prelim' },
            { id: 'midterm', title: 'Midterm' },
            { id: 'finals', title: 'Finals' },
        ]);
    });

    it('propagates persistence errors when terms.upsertTerms rejects', async () => {
        const terms = createTermRepository([]);
        vi.mocked(terms.upsertTerms).mockRejectedValue(new Error('IndexedDB disk write error'));

        const useCase = new SyncDefaultTermsUseCase(terms);
        await expect(useCase.execute()).rejects.toThrow('IndexedDB disk write error');
    });
});