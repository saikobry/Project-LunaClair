import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { ContentImporter, ExtractionOptions } from '../../../domain/importer/services/ContentImporter';
import type { ExtractionResult, PageExtraction } from '../../../domain/importer/models/importer.types';
import type { TesseractExtractor } from '../engines/TesseractExtractor';
import type { AiVisionExtractor } from '../engines/AiVisionExtractor';

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('Aborted'));
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class PdfjsImporter implements ContentImporter {
  readonly formatLabel = 'PDF Document';

  private readonly ocrExtractor: TesseractExtractor;
  private readonly visionExtractor?: AiVisionExtractor;
  private readonly minRequestSpacingMs: number;

  constructor(
    ocrExtractor: TesseractExtractor,
    visionExtractor?: AiVisionExtractor,
    minRequestSpacingMs = 12_000,
  ) {
    this.ocrExtractor = ocrExtractor;
    this.visionExtractor = visionExtractor;
    this.minRequestSpacingMs = minRequestSpacingMs;
  }

  supports(file: File): boolean {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  }

  async extract(file: File, options?: ExtractionOptions): Promise<ExtractionResult> {
    const [pdfjs, { default: pdfjsWorker }] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

    const arrayBuffer = await file.arrayBuffer();

    let pdf: PDFDocumentProxy;
    try {
      pdf = await pdfjs.getDocument({
        data: arrayBuffer,
        password: options?.password,
      }).promise;
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'PasswordException') {
        const error = new Error('Enter the PDF password to continue');
        (error as unknown as { code: string; retryable: boolean; recoveryHint: string }).code =
          'pdf-password-protected';
        (error as unknown as { code: string; retryable: boolean; recoveryHint: string }).retryable =
          true;
        (error as unknown as { code: string; retryable: boolean; recoveryHint: string }).recoveryHint =
          'Enter the PDF password to continue';
        throw error;
      }
      throw err;
    }

    const pages: PageExtraction[] = [];
    let ocrPages = 0;
    let visionPages = 0;
    let textPages = 0;
    let totalChars = 0;
    let lastVisionRequestStartTime = 0;

    const buildResult = (isPartial = false): ExtractionResult => {
      const fullText = pages.map((p) => p.text).join('\n\n');
      const wordCount = fullText.split(/\s+/).filter(Boolean).length;
      return {
        text: fullText,
        title: file.name.replace(/\.[^/.]+$/, ''),
        pageCount: pdf.numPages,
        pages: [...pages],
        stats: {
          wordCount,
          characterCount: totalChars,
          headingsDetected: 0,
          ocrPages,
          visionPages,
          textPages,
        },
        ...(isPartial ? { isPartial: true } : {}),
      };
    };

    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        if (options?.signal?.aborted) {
          throw new Error('Aborted');
        }

        options?.onProgress?.({
          phase: 'extracting',
          current: i,
          total: pdf.numPages,
          percent: Math.round(((i - 1) / pdf.numPages) * 100),
          pageLabel: `Page ${i}`,
        });

        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items
          .filter(
            (item: unknown): item is TextItem =>
              typeof item === 'object' && item !== null && 'str' in item,
          )
          .map((item: TextItem) => item.str)
          .join(' ');

        const operatorList = await page.getOperatorList();
        const hasImages = operatorList.fnArray.includes(pdfjs.OPS.paintImageXObject);

        const shouldRunAiVision = options?.ocrEngine === 'ai-vision';
        const shouldRunLocalOcr = options?.ocrEngine !== 'ai-vision' && text.length < 50 && hasImages;

        if (shouldRunAiVision || shouldRunLocalOcr) {
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas 2d context not available');

          await page.render({
            canvasContext: ctx,
            viewport: viewport,
          } as unknown as Parameters<typeof page.render>[0]).promise;

          if (shouldRunAiVision) {
            if (!this.visionExtractor) {
              throw new Error('AI Vision extractor is not initialized in the application registry. Please reload the application.');
            }
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              throw new Error('AI Vision extraction requires an active internet connection.');
            }

            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

            let attempts = 0;
            const maxRetries = 2;

            while (true) {
              if (options?.signal?.aborted) {
                throw new Error('Aborted');
              }

              const elapsed = Date.now() - lastVisionRequestStartTime;
              if (lastVisionRequestStartTime > 0 && elapsed < this.minRequestSpacingMs) {
                await abortableSleep(this.minRequestSpacingMs - elapsed, options?.signal);
              }
              lastVisionRequestStartTime = Date.now();

              options?.onProgress?.({
                phase: 'ai-vision',
                current: i,
                total: pdf.numPages,
                percent: Math.round(((i - 1) / pdf.numPages) * 100),
                pageLabel: `AI Vision Page ${i}`,
              });

              try {
                const ocrResult = await this.visionExtractor.extractPageFromDataUrl(
                  dataUrl,
                  i,
                  { signal: options?.signal },
                );
                pages.push(ocrResult);
                visionPages++;
                totalChars += ocrResult.text.length;
                break;
              } catch (err: unknown) {
                if (
                  options?.signal?.aborted ||
                  (err instanceof Error && (err.message === 'Aborted' || err.name === 'AbortError'))
                ) {
                  throw err;
                }

                const isRateLimit =
                  (err as { code?: string })?.code === 'RATE_LIMITED' ||
                  /rate limit|429/i.test((err as Error)?.message || '');

                if (isRateLimit && attempts < maxRetries) {
                  attempts++;
                  const retryAfter =
                    typeof (err as { retryAfterSeconds?: number })?.retryAfterSeconds === 'number' &&
                    (err as { retryAfterSeconds?: number }).retryAfterSeconds! > 0
                      ? (err as { retryAfterSeconds?: number }).retryAfterSeconds!
                      : 12;

                  options?.onProgress?.({
                    phase: 'cooldown',
                    current: i,
                    total: pdf.numPages,
                    percent: Math.round(((i - 1) / pdf.numPages) * 100),
                    pageLabel: `Rate limited. Cooling down for ${retryAfter}s (attempt ${attempts}/${maxRetries})...`,
                  });

                  await abortableSleep(retryAfter * 1000, options?.signal);
                  continue;
                }
                throw err;
              }
            }
          } else {
            // Local Tesseract OCR branch strictly
            options?.onProgress?.({
              phase: 'ocr',
              current: i,
              total: pdf.numPages,
              percent: Math.round(((i - 1) / pdf.numPages) * 100),
              pageLabel: `OCR Page ${i}`,
            });

            const blob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error('Canvas toBlob failed'));
              }, 'image/png');
            });

            const ocrResult = await this.ocrExtractor.extractFromBlob(
              blob,
              i,
              options?.signal,
              options?.language,
            );
            pages.push(ocrResult);
            ocrPages++;
            totalChars += ocrResult.text.length;
          }
        } else {
          pages.push({
            pageNumber: i,
            text,
            confidence: 1.0,
            source: 'pdf-text',
          });
          textPages++;
          totalChars += text.length;
        }

        page.cleanup();
      }
    } catch (err: unknown) {
      if (
        options?.signal?.aborted ||
        (err instanceof Error && (err.message === 'Aborted' || err.name === 'AbortError'))
      ) {
        const partialResult = buildResult(true);
        const abortError = err instanceof Error ? err : new Error('Aborted');
        (abortError as unknown as { partialResult: ExtractionResult }).partialResult =
          partialResult;
        throw abortError;
      }
      throw err;
    }

    return buildResult(false);
  }
}
