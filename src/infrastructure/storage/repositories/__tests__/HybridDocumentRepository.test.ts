import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HybridDocumentRepository } from '../HybridDocumentRepository';
import type { DocumentContentRepository } from '../../../../domain/reader/repositories/DocumentContentRepository';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

describe('HybridDocumentRepository', () => {
    let mockLocalRepo: DocumentContentRepository;
    let hybridRepo: HybridDocumentRepository;

    const sampleMaterial: StudyMaterial = {
        id: 'mat-1',
        title: 'Cell Biology Notes',
        documentId: 'doc-1',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
    };

    beforeEach(() => {
        mockLocalRepo = {
            getByDocumentId: vi.fn(),
            save: vi.fn(),
            deleteByDocumentId: vi.fn(),
        } as unknown as DocumentContentRepository;

        hybridRepo = new HybridDocumentRepository(mockLocalRepo);
    });

    it('returns local document content when available locally', async () => {
        vi.mocked(mockLocalRepo.getByDocumentId).mockResolvedValue({
            documentId: 'doc-1',
            title: 'Cell Biology Notes (Local)',
            content: '# Local Notes',
            updatedAt: '2026-08-02T00:00:00.000Z',
        });

        const doc = await hybridRepo.getDocumentByMaterial(sampleMaterial);

        expect(doc).toEqual({
            id: 'mat-1',
            title: 'Cell Biology Notes (Local)',
            content: '# Local Notes',
            format: 'markdown',
        });
        expect(mockLocalRepo.getByDocumentId).toHaveBeenCalledWith('doc-1', undefined);
    });

    it('returns empty document markdown when document is not yet found in local store', async () => {
        vi.mocked(mockLocalRepo.getByDocumentId).mockResolvedValue(null);

        const doc = await hybridRepo.getDocumentByMaterial(sampleMaterial);

        expect(doc).toEqual({
            id: 'mat-1',
            title: 'Cell Biology Notes',
            content: '',
            format: 'markdown',
        });
    });

    it('propagates abort signal to local repository lookup', async () => {
        const controller = new AbortController();
        vi.mocked(mockLocalRepo.getByDocumentId).mockResolvedValue(null);

        await hybridRepo.getDocumentByMaterial(sampleMaterial, controller.signal);

        expect(mockLocalRepo.getByDocumentId).toHaveBeenCalledWith('doc-1', controller.signal);
    });
});
