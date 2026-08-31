import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { ContentImporter, ExtractionOptions } from '../../domain/importer/ContentImporter';
import type { ExtractionResult, PageExtraction } from '../../domain/importer/importer.types';
import type { TesseractExtractor } from './TesseractExtractor';

export class PdfjsImporter implements ContentImporter {
  readonly formatLabel = 'PDF Document';

  private readonly ocrExtractor: TesseractExtractor;

  constructor(ocrExtractor: TesseractExtractor) {
    this.ocrExtractor = ocrExtractor;
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
    } catch (err: any) {
      if (err.name === 'PasswordException') {
        const error = new Error('Enter the PDF password to continue');
        (error as any).code = 'pdf-password-protected';
        (error as any).retryable = true;
        (error as any).recoveryHint = 'Enter the PDF password to continue';
        throw error;
      }
      throw err;
    }

    const pages: PageExtraction[] = [];
    let ocrPages = 0;
    let textPages = 0;
    let totalChars = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      if (options?.signal?.aborted) throw new Error('Aborted');
      
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
        .filter((item: unknown): item is TextItem => typeof item === 'object' && item !== null && 'str' in item)
        .map((item: TextItem) => item.str)
        .join(' ');

      const operatorList = await page.getOperatorList();
      const hasImages = operatorList.fnArray.includes(pdfjs.OPS.paintImageXObject);
      
      if (text.length < 50 && hasImages) {
        options?.onProgress?.({
          phase: 'ocr',
          current: i,
          total: pdf.numPages,
          percent: Math.round(((i - 1) / pdf.numPages) * 100),
          pageLabel: `OCR Page ${i}`,
        });

        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2d context not available');

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        } as any).promise;

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Canvas toBlob failed'));
          }, 'image/png');
        });

        const ocrResult = await this.ocrExtractor.extractFromBlob(blob, i, options?.signal, options?.language);
        pages.push(ocrResult);
        ocrPages++;
        totalChars += ocrResult.text.length;
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

    const fullText = pages.map((p) => p.text).join('\n\n');
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;

    return {
      text: fullText,
      title: file.name,
      pageCount: pdf.numPages,
      pages,
      stats: {
        wordCount,
        characterCount: totalChars,
        headingsDetected: 0,
        ocrPages,
        textPages,
      },
    };
  }
}
