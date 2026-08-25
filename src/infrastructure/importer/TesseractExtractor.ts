import type { Worker } from 'tesseract.js';
import type { ExtractionOptions } from '../../domain/importer/ContentImporter';
import type { ExtractionResult, PageExtraction } from '../../domain/importer/importer.types';

export class TesseractExtractor {
  private workerPromise: Promise<Worker> | null = null;
  private currentLanguage = 'eng';

  private async getWorker(language: string, onProgress?: (msg: any) => void): Promise<Worker> {
    if (this.workerPromise && this.currentLanguage === language) {
      const worker = await this.workerPromise;
      return worker;
    }

    if (this.workerPromise) {
      const oldWorker = await this.workerPromise;
      await oldWorker.terminate();
    }

    const { createWorker } = await import('tesseract.js');
    this.currentLanguage = language;
    this.workerPromise = createWorker(language, 1, {
      logger: (m) => {
        if (onProgress && m.status === 'recognizing text') {
          onProgress(m);
        }
      },
    });

    return this.workerPromise;
  }

  private async preprocessImage(blob: Blob): Promise<Blob> {
    try {
      // Create image bitmap, which handles HEIC decoding if supported by the browser,
      // and typically handles EXIF rotation.
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.drawImage(bitmap, 0, 0);

      // Convert to grayscale and enhance contrast
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Luminance
        const v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        
        // Basic contrast enhancement (simple stretch or just leave it grayscale)
        // We'll just set it to grayscale
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }
      ctx.putImageData(imageData, 0, 0);

      return new Promise((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/png');
      });
    } catch {
      if (blob.type === 'image/heic' || blob.type === 'image/heif') {
        const error = new Error('HEIC/HEIF is not supported in this browser without a polyfill.');
        (error as any).code = 'unsupported-file';
        (error as any).retryable = false;
        (error as any).recoveryHint = 'Please convert the image to JPEG or PNG.';
        throw error;
      }
      // If preprocessing fails, just return original blob
      return blob;
    }
  }

  async extract(file: File, options?: ExtractionOptions): Promise<ExtractionResult> {
    const signal = options?.signal;
    if (signal?.aborted) throw new Error('Aborted');

    const processedBlob = await this.preprocessImage(file);
    if (signal?.aborted) throw new Error('Aborted');

    const language = options?.language || 'eng';
    
    options?.onProgress?.({
      phase: 'loading',
      current: 0,
      total: 100,
      percent: 0
    });

    const worker = await this.getWorker(language, (msg) => {
      options?.onProgress?.({
        phase: 'ocr',
        current: Math.round(msg.progress * 100),
        total: 100,
        percent: Math.round(msg.progress * 100),
      });
    });

    if (signal?.aborted) {
      throw new Error('Aborted');
    }

    const { data } = await worker.recognize(processedBlob);
    
    const text = data.text;
    const confidence = data.confidence / 100; // tesseract gives 0-100

    const page: PageExtraction = {
      pageNumber: 1,
      text,
      confidence,
      source: 'ocr',
    };

    return {
      text,
      title: file.name,
      pageCount: 1,
      pages: [page],
      stats: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
        characterCount: text.length,
        headingsDetected: 0,
        ocrPages: 1,
        textPages: 0,
      },
    };
  }

  async extractFromBlob(blob: Blob, pageNumber: number, signal?: AbortSignal, language = 'eng'): Promise<PageExtraction> {
    if (signal?.aborted) throw new Error('Aborted');
    const processedBlob = await this.preprocessImage(blob);
    if (signal?.aborted) throw new Error('Aborted');

    const worker = await this.getWorker(language);
    if (signal?.aborted) throw new Error('Aborted');

    const { data } = await worker.recognize(processedBlob);

    return {
      pageNumber,
      text: data.text,
      confidence: data.confidence / 100,
      source: 'ocr',
    };
  }
}

export const tesseractExtractor = new TesseractExtractor();
