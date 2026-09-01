import { describe, expect, it, vi } from 'vitest';
import { SyncDefaultTermsUseCase } from '../SyncDefaultTermsUseCase';
import type { CatalogRepository, CatalogSnapshot } from '../../../../domain/library/CatalogRepository';
import type { TermRepository } from '../../../../domain/library/TermRepository';
import type { Term } from '../../../../domain/library/Term';

describe('SyncDefaultTermsUseCase', () => {
    const catalogPrelim: Term = {
        id: 'term-prelim',
        title: 'Prelim',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const catalogMidterm: Term = {
        id: 'term-midterm',
        title: 'Midterm',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const catalogFinals: Term = {
        id: 'term-finals',
        title: 'Finals',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    const mockCatalogSnapshot: CatalogSnapshot = {
        subjects: [],
        terms: [catalogPrelim, catalogMidterm, catalogFinals],
        subjectTerms: [],
        materials: [],
    };

    const createServices = (localTerms: Term[] = []) => {
        const catalog: CatalogRepository = {
            getCatalog: vi.fn().mockResolvedValue(mockCatalogSnapshot),
            getMaterial: vi.fn(),
        };

        const terms: TermRepository = {
            getTerms: vi.fn().mockResolvedValue(localTerms),
            getTermById: vi.fn(),
            createTerm: vi.fn(),
            updateTerm: vi.fn(),
            deleteTerm: vi.fn(),
            upsertTerms: vi.fn().mockResolvedValue(undefined),
        };

        return { catalog, terms };
    };

    it('syncs missing default terms into local terms store', async () => {
        const { catalog, terms } = createServices([]);
        const useCase = new SyncDefaultTermsUseCase(catalog, terms);

        const result = await useCase.execute();

        expect(terms.upsertTerms).toHaveBeenCalledWith([catalogPrelim, catalogMidterm, catalogFinals]);
        expect(result).toEqual({ synced: true, count: 3 });
    });

    it('does NOT overwrite existing local user terms (preserves user ownership invariant)', async () => {
        const customLocalPrelim: Term = {
            id: 'term-prelim',
            title: 'My Custom First Quarter Prelims', // User renamed term
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-15T00:00:00.000Z',
        };

        const { catalog, terms } = createServices([customLocalPrelim]);
        const useCase = new SyncDefaultTermsUseCase(catalog, terms);

        const result = await useCase.execute();

        // Only Midterm and Finals should be upserted; custom Prelim is untouched
        expect(terms.upsertTerms).toHaveBeenCalledWith([catalogMidterm, catalogFinals]);
        expect(result).toEqual({ synced: true, count: 2 });
    });

    it('is an idempotent no-op when all default terms exist', async () => {
        const { catalog, terms } = createServices([catalogPrelim, catalogMidterm, catalogFinals]);
        const useCase = new SyncDefaultTermsUseCase(catalog, terms);

        const result = await useCase.execute();

        expect(terms.upsertTerms).toHaveBeenCalledWith([]);
        expect(result).toEqual({ synced: true, count: 0 });
    });

    it('tolerates catalog network fetch failure and returns { synced: false, count: 0 } without throwing', async () => {
        const { catalog, terms } = createServices([]);
        vi.mocked(catalog.getCatalog).mockRejectedValue(new Error('Network offline'));

        const useCase = new SyncDefaultTermsUseCase(catalog, terms);
        const result = await useCase.execute();

        expect(result).toEqual({ synced: false, count: 0 });
        expect(terms.upsertTerms).not.toHaveBeenCalled();
    });

    it('propagates persistence errors when terms.upsertTerms rejects', async () => {
        const { catalog, terms } = createServices([]);
        vi.mocked(terms.upsertTerms).mockRejectedValue(new Error('IndexedDB disk write error'));

        const useCase = new SyncDefaultTermsUseCase(catalog, terms);
        await expect(useCase.execute()).rejects.toThrow('IndexedDB disk write error');
    });
});
