import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiCatalogRepository } from '../ApiCatalogRepository';
import type { CatalogSnapshot, MaterialResolution } from '../../../../domain/library/repositories/CatalogRepository';

describe('ApiCatalogRepository', () => {
  let repo: ApiCatalogRepository;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    repo = new ApiCatalogRepository();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getCatalog', () => {
    it('returns parsed catalog snapshot on 200 OK', async () => {
      const mockSnapshot: CatalogSnapshot = {
        subjects: [],
        terms: [],
        subjectTerms: [],
        materials: [],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSnapshot,
      } as unknown as Response);

      const result = await repo.getCatalog();
      expect(result).toEqual(mockSnapshot);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/catalog', { signal: undefined });
    });

    it('throws descriptive error on non-2xx status code', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as unknown as Response);

      await expect(repo.getCatalog()).rejects.toThrow('Failed to fetch catalog (500)');
    });

    it('propagates network failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(repo.getCatalog()).rejects.toThrow('Failed to fetch');
    });

    it('passes abort signal to fetch', async () => {
      const controller = new AbortController();
      globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

      await expect(repo.getCatalog(controller.signal)).rejects.toThrow('Aborted');
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/catalog', { signal: controller.signal });
    });
  });

  describe('getMaterial', () => {
    it('returns parsed material resolution on 200 OK', async () => {
      const mockResolution = {
        material: { id: 'mat-1', title: 'Biology', documentId: 'doc-1' },
        subject: { id: 'subj-1', title: 'Science' },
        term: null,
        subjectTerm: null,
      } as unknown as MaterialResolution;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResolution,
      } as unknown as Response);

      const result = await repo.getMaterial('mat-1');
      expect(result).toEqual(mockResolution);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/catalog/materials/mat-1', { signal: undefined });
    });

    it('throws descriptive error on non-2xx status code', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as unknown as Response);

      await expect(repo.getMaterial('mat-not-found')).rejects.toThrow(
        'Failed to fetch material mat-not-found (404)',
      );
    });
  });
});
