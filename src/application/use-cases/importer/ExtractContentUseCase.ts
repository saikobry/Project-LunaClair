import type { ImporterRegistry, ExtractionOptions } from '../../../domain/importer/services/ContentImporter';
import type {
  ImportCandidate,
  ImportSource,
  ImportError,
  ImportMetadata,
  ExtractionResult,
} from '../../../domain/importer/models/importer.types';
import { convertToMarkdown } from '../../../domain/importer/markdownConverter';

export class ExtractContentUseCase {
  private readonly registry: ImporterRegistry;

  constructor(registry: ImporterRegistry) {
    this.registry = registry;
  }

  async execute(file: File, options?: ExtractionOptions): Promise<ImportCandidate> {
    const id = crypto.randomUUID();
    const importer = this.registry.resolve(file);

    if (!importer) {
      return {
        id,
        filename: file.name,
        source: this.determineSource(file),
        file,
        status: 'error',
        error: {
          code: 'unsupported-file',
          message: `File type ${file.type || 'unknown'} is not supported.`,
          retryable: false,
        },
      };
    }

    try {
      const result = await importer.extract(file, options);
      const title = result.title || file.name.replace(/\.[^/.]+$/, '');
      
      const markdown = convertToMarkdown(result.pages, { title });
      
      const importMetadata: ImportMetadata = {
        source: this.determineSource(file),
        originalFilename: file.name,
        importedAt: new Date().toISOString(),
        pageCount: result.pageCount,
        usedOcr: result.stats.ocrPages > 0,
        ocrConfidence: result.stats.ocrPages > 0 ? this.calculateAverageConfidence(result.pages) : undefined,
        usedVision: (result.stats.visionPages ?? 0) > 0,
      };

      return {
        id,
        filename: file.name,
        source: importMetadata.source,
        file,
        extraction: result,
        markdown,
        title,
        importMetadata,
        status: 'review',
        pageDetails: result.pages,
      };
    } catch (err: unknown) {
      let code: ImportError['code'] = 'extraction-failed';
      let message = 'Failed to extract content from file.';
      let retryable = true;

      const partialResult = (err as { partialResult?: ExtractionResult })?.partialResult;

      if (options?.signal?.aborted) {
        code = 'cancelled';
        message = 'Extraction was cancelled.';
        retryable = false;
      } else if (err instanceof Error) {
        message = err.message;
      }

      if (partialResult && partialResult.pages.length > 0) {
        const title = partialResult.title || file.name.replace(/\.[^/.]+$/, '');
        const markdown = convertToMarkdown(partialResult.pages, { title });
        const importMetadata: ImportMetadata = {
          source: this.determineSource(file),
          originalFilename: file.name,
          importedAt: new Date().toISOString(),
          pageCount: partialResult.pageCount,
          usedOcr: partialResult.stats.ocrPages > 0,
          ocrConfidence:
            partialResult.stats.ocrPages > 0
              ? this.calculateAverageConfidence(partialResult.pages)
              : undefined,
          usedVision: (partialResult.stats.visionPages ?? 0) > 0,
        };

        return {
          id,
          filename: file.name,
          source: importMetadata.source,
          file,
          extraction: partialResult,
          markdown,
          title,
          importMetadata,
          status: 'review',
          pageDetails: partialResult.pages,
        };
      }

      return {
        id,
        filename: file.name,
        source: this.determineSource(file),
        file,
        status: 'error',
        error: {
          code,
          message,
          retryable,
        },
      };
    }
  }

  private determineSource(file: File): ImportSource {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      return 'pdf';
    }
    return 'image';
  }

  private calculateAverageConfidence(pages: { confidence: number }[]): number | undefined {
    const pagesWithOcr = pages.filter((p) => p.confidence > 0);
    if (pagesWithOcr.length === 0) {
      return undefined;
    }
    const sum = pagesWithOcr.reduce((acc, p) => acc + p.confidence, 0);
    return sum / pagesWithOcr.length;
  }
}
