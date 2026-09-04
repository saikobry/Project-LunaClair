import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfjsImporter } from '../PdfjsImporter';
import type { TesseractExtractor } from '../../engines/TesseractExtractor';

// Mock pdfjs-dist and worker url
const mockGetDocument = vi.fn();
const mockOPS = { paintImageXObject: 99 };
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  OPS: mockOPS,
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: 'mock-worker-url',
}));

describe('PdfjsImporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOcrExtractor = {
    extractFromBlob: vi.fn(),
    extract: vi.fn(),
  } as unknown as TesseractExtractor;

  const importer = new PdfjsImporter(mockOcrExtractor);

  it('identifies supported PDF files by extension or mime type', () => {
    expect(importer.supports(new File([], 'doc.pdf', { type: 'application/octet-stream' }))).toBe(true);
    expect(importer.supports(new File([], 'doc.PDF', { type: 'application/octet-stream' }))).toBe(true);
    expect(importer.supports(new File([], 'doc.bin', { type: 'application/pdf' }))).toBe(true);
    expect(importer.supports(new File([], 'doc.png', { type: 'image/png' }))).toBe(false);
  });

  it('classifies password-protected PDF error into retryable code', async () => {
    const passwordError = new Error('Password required');
    passwordError.name = 'PasswordException';

    mockGetDocument.mockReturnValue({
      promise: Promise.reject(passwordError),
    });

    const file = new File(['protected-pdf'], 'locked.pdf', { type: 'application/pdf' });

    await expect(importer.extract(file)).rejects.toMatchObject({
      message: 'Enter the PDF password to continue',
      code: 'pdf-password-protected',
      retryable: true,
    });
  });

  it('extracts text directly from digital PDF without OCR', async () => {
    const longText = 'A'.repeat(60); // >= 50 characters to skip OCR
    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: longText }],
      }),
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [],
      }),
      cleanup: vi.fn(),
    };

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
      }),
    });

    const file = new File(['valid-pdf'], 'digital.pdf', { type: 'application/pdf' });
    const progressCalls: any[] = [];
    const result = await importer.extract(file, {
      onProgress: (p) => progressCalls.push(p),
    });

    expect(result.pageCount).toBe(1);
    expect(result.text).toBe(longText);
    expect(result.pages[0].source).toBe('pdf-text');
    expect(result.pages[0].confidence).toBe(1.0);
    expect(mockPage.cleanup).toHaveBeenCalled();
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[0].phase).toBe('extracting');
  });

  it('delegates to OCR extractor when page text is short and page has images', async () => {
    const shortText = 'Hi';
    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: shortText }],
      }),
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [mockOPS.paintImageXObject],
      }),
      getViewport: vi.fn().mockReturnValue({ width: 100, height: 100 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      cleanup: vi.fn(),
    };

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
      }),
    });

    (mockOcrExtractor.extractFromBlob as any).mockResolvedValue({
      pageNumber: 1,
      text: 'OCR extracted text from scanned image',
      confidence: 0.92,
      source: 'ocr',
    });

    // Stub HTMLCanvasElement.prototype.getContext and toBlob in JSDOM
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
      putImageData: vi.fn(),
    }) as any;

    HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb) {
      cb(new Blob(['fake-img'], { type: 'image/png' }));
    });

    try {
      const file = new File(['scanned-pdf'], 'scanned.pdf', { type: 'application/pdf' });
      const result = await importer.extract(file);

      expect(result.pages[0].source).toBe('ocr');
      expect(result.pages[0].text).toBe('OCR extracted text from scanned image');
      expect(mockOcrExtractor.extractFromBlob).toHaveBeenCalled();
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      HTMLCanvasElement.prototype.toBlob = originalToBlob;
    }
  });
});
