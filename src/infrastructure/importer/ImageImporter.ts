import type { ContentImporter, ExtractionOptions } from '../../domain/importer/ContentImporter';
import type { ExtractionResult } from '../../domain/importer/importer.types';
import type { TesseractExtractor } from './TesseractExtractor';

export class ImageImporter implements ContentImporter {
  readonly formatLabel = 'Image (OCR)';

  private readonly ocrExtractor: TesseractExtractor;

  constructor(ocrExtractor: TesseractExtractor) {
    this.ocrExtractor = ocrExtractor;
  }

  supports(file: File): boolean {
    const validTypes = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/jfif', 'image/heic', 'image/heif', 'image/webp'];
    if (validTypes.includes(file.type.toLowerCase())) {
        return true;
    }
    return /\.(png|jpe?g|jfif|heic|heif|webp)$/i.test(file.name);
  }

  async extract(file: File, options?: ExtractionOptions): Promise<ExtractionResult> {
    return this.ocrExtractor.extract(file, options);
  }
}
