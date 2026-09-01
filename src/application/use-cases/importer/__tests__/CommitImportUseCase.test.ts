import { describe, it, expect } from 'vitest';
import { CommitImportUseCase } from '../CommitImportUseCase';

describe('CommitImportUseCase', () => {
    it('persists material, document content, and original asset', async () => {
        let createdMaterial: any = null;
        let putContent: any = null;
        let putAsset: any = null;

        const mockLibraryRepo: any = {
            createMaterial: async (input: any) => {
                createdMaterial = input;
                return {
                    id: input.id || 'mat-123',
                    title: input.title,
                    documentId: input.documentId || 'doc-123',
                    subjectId: input.subjectId,
                    termId: input.termId,
                    createdAt: input.createdAt,
                    updatedAt: input.updatedAt,
                };
            },
        };
        const mockDocRepo: any = {
            put: async (input: any) => {
                putContent = input;
            },
        };
        const mockAssetRepo: any = {
            put: async (input: any) => {
                putAsset = input;
            },
        };

        const useCase = new CommitImportUseCase(mockLibraryRepo, mockDocRepo, mockAssetRepo);
        const file = new File(['raw bytes'], 'anatomy.pdf', { type: 'application/pdf' });

        const result = await useCase.execute({
            title: 'Anatomy Notes',
            markdown: '# Anatomy Notes\n\nContent',
            file,
            importMetadata: {
                source: 'pdf',
                originalFilename: 'anatomy.pdf',
                importedAt: new Date().toISOString(),
                pageCount: 1,
                usedOcr: false,
            },
            subjectId: 'sub-bio',
            termId: 'term-prelim',
        });

        expect(result.title).toBe('Anatomy Notes');
        expect(result.subjectId).toBe('sub-bio');
        expect(result.termId).toBe('term-prelim');
        expect(createdMaterial).toBeDefined();
        expect(createdMaterial.title).toBe('Anatomy Notes');
        expect(putContent.content).toContain('Anatomy Notes');
        expect(putAsset.filename).toBe('anatomy.pdf');
    });
});
