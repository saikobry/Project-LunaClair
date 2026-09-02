import { describe, it, expect } from 'vitest';
import { ExtractContentUseCase } from '../ExtractContentUseCase';
import type { ImporterRegistry, ContentImporter } from '../../../../domain/importer/services/ContentImporter';
import type { ExtractionResult } from '../../../../domain/importer/models/importer.types';

describe('ExtractContentUseCase', () => {
    it('extracts content and converts to markdown', async () => {
        const mockResult: ExtractionResult = {
            text: 'Sample text',
            title: 'Sample Document',
            pageCount: 2,
            pages: [
                { pageNumber: 1, text: 'Page 1 content', confidence: 1, source: 'pdf-text' },
                { pageNumber: 2, text: 'Page 2 content', confidence: 0.9, source: 'ocr' },
            ],
            stats: {
                wordCount: 6,
                characterCount: 28,
                headingsDetected: 0,
                ocrPages: 1,
                textPages: 1,
            },
        };

        const mockImporter: ContentImporter = {
            formatLabel: 'PDF Document',
            supports: (file) => file.name.endsWith('.pdf'),
            extract: async () => mockResult,
        };

        const mockRegistry: ImporterRegistry = {
            importers: [mockImporter],
            acceptedTypes: '.pdf',
            resolve: (file) => (mockImporter.supports(file) ? mockImporter : undefined),
        };

        const useCase = new ExtractContentUseCase(mockRegistry);
        const file = new File(['fake pdf'], 'test.pdf', { type: 'application/pdf' });
        const candidate = await useCase.execute(file);

        expect(candidate.status).toBe('review');
        expect(candidate.filename).toBe('test.pdf');
        expect(candidate.source).toBe('pdf');
        expect(candidate.markdown).toContain('Page 1 content');
        expect(candidate.markdown).toContain('## Page 2');
        expect(candidate.pageDetails).toHaveLength(2);
    });

    it('handles unsupported file types gracefully', async () => {
        const mockRegistry: ImporterRegistry = {
            importers: [],
            acceptedTypes: '.pdf',
            resolve: () => undefined,
        };

        const useCase = new ExtractContentUseCase(mockRegistry);
        const file = new File(['fake exe'], 'test.exe', { type: 'application/octet-stream' });
        const candidate = await useCase.execute(file);

        expect(candidate.status).toBe('error');
        expect(candidate.error?.code).toBe('unsupported-file');
    });
});
