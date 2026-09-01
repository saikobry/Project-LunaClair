import { describe, expect, it, vi } from 'vitest';
import { UpdateDocumentContentUseCase } from '../UpdateDocumentContentUseCase';
import type { DocumentContentRepository } from '../../../../domain/reader/DocumentContentRepository';

describe('UpdateDocumentContentUseCase', () => {
    it('updates markdown content record in documentContentRepository', async () => {
        const mockRepo: DocumentContentRepository = {
            getByDocumentId: vi.fn(),
            put: vi.fn().mockResolvedValue(undefined),
            deleteByDocumentId: vi.fn(),
        };

        const useCase = new UpdateDocumentContentUseCase(mockRepo);
        const before = new Date().toISOString();

        const result = await useCase.execute({
            documentId: 'doc-101',
            title: 'Cell Biology Notes',
            content: '# Chapter 1\nCells are the basic structural unit.',
        });

        const after = new Date().toISOString();

        expect(result.documentId).toBe('doc-101');
        expect(result.title).toBe('Cell Biology Notes');
        expect(result.content).toBe('# Chapter 1\nCells are the basic structural unit.');
        expect(result.updatedAt >= before).toBe(true);
        expect(result.updatedAt <= after).toBe(true);

        expect(mockRepo.put).toHaveBeenCalledWith(result);
    });

    it('rejects with error when documentId is empty or missing', async () => {
        const mockRepo: DocumentContentRepository = {
            getByDocumentId: vi.fn(),
            put: vi.fn(),
            deleteByDocumentId: vi.fn(),
        };

        const useCase = new UpdateDocumentContentUseCase(mockRepo);

        await expect(
            useCase.execute({
                documentId: '',
                title: 'No Doc ID',
                content: 'Some text',
            }),
        ).rejects.toThrow('documentId is required to update document content');

        expect(mockRepo.put).not.toHaveBeenCalled();
    });

    it('propagates persistence errors when put rejects', async () => {
        const mockRepo: DocumentContentRepository = {
            getByDocumentId: vi.fn(),
            put: vi.fn().mockRejectedValue(new Error('IndexedDB storage quota exceeded')),
            deleteByDocumentId: vi.fn(),
        };

        const useCase = new UpdateDocumentContentUseCase(mockRepo);

        await expect(
            useCase.execute({
                documentId: 'doc-101',
                title: 'Note',
                content: 'Text',
            }),
        ).rejects.toThrow('IndexedDB storage quota exceeded');
    });
});
