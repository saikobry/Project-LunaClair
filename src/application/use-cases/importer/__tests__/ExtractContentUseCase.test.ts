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

    it('preserves partial extraction results into review candidate when cancelled mid-job', async () => {
        const partialResult: ExtractionResult = {
            text: 'Page 1 extracted content',
            title: 'Partial Doc',
            pageCount: 3,
            pages: [
                { pageNumber: 1, text: 'Page 1 extracted content', confidence: 95, source: 'ai-vision' },
            ],
            stats: {
                wordCount: 4,
                characterCount: 24,
                headingsDetected: 0,
                ocrPages: 1,
                textPages: 0,
            },
            isPartial: true,
        };

        const mockImporter: ContentImporter = {
            formatLabel: 'PDF Document',
            supports: () => true,
            extract: async () => {
                const abortErr = new Error('Aborted');
                abortErr.name = 'AbortError';
                (abortErr as any).partialResult = partialResult;
                throw abortErr;
            },
        };

        const mockRegistry: ImporterRegistry = {
            importers: [mockImporter],
            acceptedTypes: '.pdf',
            resolve: () => mockImporter,
        };

        const useCase = new ExtractContentUseCase(mockRegistry);
        const file = new File(['data'], 'partial.pdf', { type: 'application/pdf' });
        const ac = new AbortController();
        ac.abort();

        const candidate = await useCase.execute(file, { signal: ac.signal });

        expect(candidate.status).toBe('review');
        expect(candidate.extraction?.isPartial).toBe(true);
        expect(candidate.extraction?.pages).toHaveLength(1);
        expect(candidate.markdown).toContain('Page 1 extracted content');
    });

    it('populates usedVision in importMetadata when visionPages are present', async () => {
        const mockResult: ExtractionResult = {
            text: 'Vision transcribed text',
            title: 'Vision Doc',
            pageCount: 1,
            pages: [
                { pageNumber: 1, text: 'Vision transcribed text', confidence: 95, source: 'ai-vision' },
            ],
            stats: {
                wordCount: 3,
                characterCount: 23,
                headingsDetected: 0,
                ocrPages: 0,
                visionPages: 1,
                textPages: 0,
            },
        };

        const mockImporter: ContentImporter = {
            formatLabel: 'Image (OCR)',
            supports: () => true,
            extract: async () => mockResult,
        };

        const mockRegistry: ImporterRegistry = {
            importers: [mockImporter],
            acceptedTypes: '.png',
            resolve: () => mockImporter,
        };

        const useCase = new ExtractContentUseCase(mockRegistry);
        const file = new File(['fake img'], 'test.png', { type: 'image/png' });
        const candidate = await useCase.execute(file);

        expect(candidate.status).toBe('review');
        expect(candidate.importMetadata?.usedVision).toBe(true);
        expect(candidate.importMetadata?.usedOcr).toBe(false);
    });

    it('strips file extensions from candidate title', async () => {
        const mockResult: ExtractionResult = {
            text: 'Content',
            title: 'biology_notes.pdf',
            pageCount: 1,
            pages: [{ pageNumber: 1, text: 'Content', confidence: 1, source: 'pdf-text' }],
            stats: { wordCount: 1, characterCount: 7, headingsDetected: 0, ocrPages: 0, textPages: 1 },
        };

        const mockImporter: ContentImporter = {
            formatLabel: 'PDF Document',
            supports: () => true,
            extract: async () => mockResult,
        };

        const mockRegistry: ImporterRegistry = {
            importers: [mockImporter],
            acceptedTypes: '.pdf',
            resolve: () => mockImporter,
        };

        const useCase = new ExtractContentUseCase(mockRegistry);
        const file = new File(['fake'], 'biology_notes.pdf', { type: 'application/pdf' });
        const candidate = await useCase.execute(file);

        expect(candidate.title).toBe('biology_notes');
    });
});
