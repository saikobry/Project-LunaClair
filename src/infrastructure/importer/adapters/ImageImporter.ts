import type { ContentImporter, ExtractionOptions } from '../../../domain/importer/services/ContentImporter';
import type { ExtractionResult } from '../../../domain/importer/models/importer.types';
import type { TesseractExtractor } from '../engines/TesseractExtractor';
import type { AiVisionExtractor } from '../engines/AiVisionExtractor';

export class ImageImporter implements ContentImporter {
  readonly formatLabel = 'Image (OCR)';

  private readonly ocrExtractor: TesseractExtractor;
  private readonly visionExtractor?: AiVisionExtractor;

  constructor(ocrExtractor: TesseractExtractor, visionExtractor?: AiVisionExtractor) {
    this.ocrExtractor = ocrExtractor;
    this.visionExtractor = visionExtractor;
  }

  supports(file: File): boolean {
    const validTypes = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/jfif', 'image/heic', 'image/heif', 'image/webp'];
    if (validTypes.includes(file.type.toLowerCase())) {
      return true;
    }
    return /\.(png|jpe?g|jfif|heic|heif|webp)$/i.test(file.name);
  }

  async extract(file: File, options?: ExtractionOptions): Promise<ExtractionResult> {
    if (options?.ocrEngine === 'ai-vision') {
      if (!this.visionExtractor) {
        throw new Error('AI Vision extractor is not initialized in the application registry. Please reload the application.');
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('AI Vision extraction requires an active internet connection.');
      }

      options?.onProgress?.({
        phase: 'ai-vision',
        current: 1,
        total: 1,
        percent: 50,
        pageLabel: 'AI Vision Image Transcription...',
      });

      const dataUrl = await this.fileToJpegDataUrl(file);
      const pageExtraction = await this.visionExtractor.extractPageFromDataUrl(dataUrl, 1, {
        signal: options?.signal,
      });

      const text = pageExtraction.text;
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      return {
        text,
        title: file.name.replace(/\.[^/.]+$/, ''),
        pageCount: 1,
        pages: [pageExtraction],
        stats: {
          wordCount,
          characterCount: text.length,
          headingsDetected: 0,
          ocrPages: 0,
          visionPages: 1,
          textPages: 0,
        },
      };
    }

    return this.ocrExtractor.extract(file, options);
  }

  private async fileToJpegDataUrl(file: File): Promise<string> {
    if (typeof document !== 'undefined' && typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
          return canvas.toDataURL('image/jpeg', 0.85);
        }
      } catch {
        // Fall back to FileReader
      }
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read image as data URL'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }
}
