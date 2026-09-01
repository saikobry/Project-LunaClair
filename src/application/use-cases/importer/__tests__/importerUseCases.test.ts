import { describe, it, expect } from 'vitest';
import { ExtractContentUseCase } from '../ExtractContentUseCase';
import { CommitImportUseCase } from '../CommitImportUseCase';
import { CleanupImportWithAiUseCase } from '../CleanupImportWithAiUseCase';
import type { ImporterRegistry, ContentImporter } from '../../../../domain/importer/ContentImporter';
import type { ExtractionResult } from '../../../../domain/importer/importer.types';
import type { AiService } from '../../../../domain/ai/AiService';
import type { AiStreamEvent } from '../../../../domain/ai/ai.types';

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

describe('CleanupImportWithAiUseCase', () => {
  it('streams cleaned markdown and returns both original and cleaned versions', async () => {
    const mockAiService: AiService = {
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        yield { type: 'token', text: '```markdown\n# Cleaned Heading\n\n- Point A\n- Point B\n```' };
      },
      async generateStructured(): Promise<any> {
        throw new Error('Not used');
      },
    };

    const useCase = new CleanupImportWithAiUseCase(mockAiService);
    const result = await useCase.execute('dirty text', 'My Doc');

    expect(result.original).toBe('dirty text');
    expect(result.cleaned).toBe('# Cleaned Heading\n\n- Point A\n- Point B');
  });
});

describe('ImageImporter format support', () => {
  it('supports .jfif, .jpg, .png, and image/jfif MIME types', async () => {
    const { ImageImporter } = await import('../../../../infrastructure/importer/ImageImporter');
    const mockOcr: any = {};
    const importer = new ImageImporter(mockOcr);

    const jfifFile = new File([''], 'photo.jfif', { type: 'image/jfif' });
    const jfifFileExtOnly = new File([''], 'diagram.JFIF', { type: '' });
    const pngFile = new File([''], 'screenshot.png', { type: 'image/png' });
    const pdfFile = new File([''], 'doc.pdf', { type: 'application/pdf' });

    expect(importer.supports(jfifFile)).toBe(true);
    expect(importer.supports(jfifFileExtOnly)).toBe(true);
    expect(importer.supports(pngFile)).toBe(true);
    expect(importer.supports(pdfFile)).toBe(false);
  });
});
