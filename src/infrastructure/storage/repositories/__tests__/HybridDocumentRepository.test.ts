import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HybridDocumentRepository } from '../HybridDocumentRepository';
import type { DocumentContentRepository } from '../../../../domain/reader/repositories/DocumentContentRepository';
import type { DocumentRepository } from '../../../../domain/reader/repositories/DocumentRepository';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import { DocumentNotFoundError } from '../../../../domain/reader/errors/DocumentNotFoundError';

describe('HybridDocumentRepository', () => {
    let mockLocalRepo: DocumentContentRepository;
    let mockRemoteRepo: DocumentRepository;
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

        mockRemoteRepo = {
            getDocumentByMaterial: vi.fn(),
        } as unknown as DocumentRepository;

        hybridRepo = new HybridDocumentRepository(mockLocalRepo, mockRemoteRepo);
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
        expect(mockRemoteRepo.getDocumentByMaterial).not.toHaveBeenCalled();
    });

    it('falls back to remote repository when not found in local store', async () => {
        vi.mocked(mockLocalRepo.getByDocumentId).mockResolvedValue(null);
        vi.mocked(mockRemoteRepo.getDocumentByMaterial).mockResolvedValue({
            id: 'mat-1',
            title: 'Cell Biology Notes (Remote)',
            content: '# Remote Content',
            format: 'markdown',
        });

        const doc = await hybridRepo.getDocumentByMaterial(sampleMaterial);

        expect(doc).toEqual({
            id: 'mat-1',
            title: 'Cell Biology Notes (Remote)',
            content: '# Remote Content',
            format: 'markdown',
        });
        expect(mockRemoteRepo.getDocumentByMaterial).toHaveBeenCalledWith(sampleMaterial, undefined);
    });

    it('returns empty document markdown when remote throws DocumentNotFoundError', async () => {
        vi.mocked(mockLocalRepo.getByDocumentId).mockResolvedValue(null);
        vi.mocked(mockRemoteRepo.getDocumentByMaterial).mockRejectedValue(
            new DocumentNotFoundError('doc-1')
        );

        const doc = await hybridRepo.getDocumentByMaterial(sampleMaterial);

        expect(doc).toEqual({
            id: 'mat-1',
            title: 'Cell Biology Notes',
            content: '',
            format: 'markdown',
        });
    });

    it('rethrows unexpected errors from remote repository', async () => {
        vi.mocked(mockLocalRepo.getByDocumentId).mockResolvedValue(null);
        const networkError = new Error('Network timeout');
        vi.mocked(mockRemoteRepo.getDocumentByMaterial).mockRejectedValue(networkError);

        await expect(hybridRepo.getDocumentByMaterial(sampleMaterial)).rejects.toThrow(
            'Network timeout'
        );
    });
});
