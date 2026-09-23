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
    expect(result.title).toBe('digital');
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

  it('delegates to visionExtractor when ocrEngine is ai-vision and online', async () => {
    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'Scan' }] }),
      getOperatorList: vi.fn().mockResolvedValue({ fnArray: [mockOPS.paintImageXObject] }),
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

    const mockVisionExtractor = {
      extractPageFromDataUrl: vi.fn().mockResolvedValue({
        pageNumber: 1,
        text: '# AI Vision Extracted Markdown',
        confidence: 95,
        source: 'ai-vision',
      }),
    };

    const visionImporter = new PdfjsImporter(mockOcrExtractor, mockVisionExtractor as any);

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    }) as any;
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,mockdata');

    try {
      const file = new File(['scanned-pdf'], 'scanned.pdf', { type: 'application/pdf' });
      const progressCalls: any[] = [];
      const result = await visionImporter.extract(file, {
        ocrEngine: 'ai-vision',
        onProgress: (p) => progressCalls.push(p),
      });

      expect(result.pages[0].source).toBe('ai-vision');
      expect(result.pages[0].text).toBe('# AI Vision Extracted Markdown');
      expect(result.stats.visionPages).toBe(1);
      expect(result.stats.ocrPages).toBe(0);
      expect(progressCalls.some((p) => p.phase === 'ai-vision')).toBe(true);
      expect(mockVisionExtractor.extractPageFromDataUrl).toHaveBeenCalledWith(
        'data:image/jpeg;base64,mockdata',
        1,
        expect.anything(),
      );
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    }
  });

  it('extracts with AI Vision even when page contains text (>= 50 chars) or existing OCR layer', async () => {
    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: 'This is an existing text or noisy embedded phone OCR layer with more than 50 characters of content.' }],
      }),
      getOperatorList: vi.fn().mockResolvedValue({
        fnArray: [],
      }),
      getViewport: vi.fn().mockReturnValue({ width: 600, height: 800 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      cleanup: vi.fn(),
    };

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
      }),
    });

    const mockVisionExtractor = {
      extractPageFromDataUrl: vi.fn().mockResolvedValue({
        pageNumber: 1,
        text: '# AI Vision Extracted Structure\n\n| Table | Data |',
        confidence: 95,
        source: 'ai-vision',
      }),
    };

    const visionImporter = new PdfjsImporter(mockOcrExtractor, mockVisionExtractor as any);

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    }) as any;
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,mockdata');

    try {
      const file = new File(['text-pdf'], 'text.pdf', { type: 'application/pdf' });
      const result = await visionImporter.extract(file, {
        ocrEngine: 'ai-vision',
      });

      expect(result.pages[0].source).toBe('ai-vision');
      expect(result.pages[0].text).toContain('# AI Vision Extracted Structure');
      expect(result.stats.visionPages).toBe(1);
      expect(mockVisionExtractor.extractPageFromDataUrl).toHaveBeenCalled();
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    }
  });


  it('throws explicit error when ocrEngine is ai-vision but visionExtractor is missing', async () => {
    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'Scan' }] }),
      getOperatorList: vi.fn().mockResolvedValue({ fnArray: [mockOPS.paintImageXObject] }),
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

    const noVisionImporter = new PdfjsImporter(mockOcrExtractor, undefined);

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() }) as any;

    try {
      const file = new File(['scanned-pdf'], 'scanned.pdf', { type: 'application/pdf' });
      await expect(noVisionImporter.extract(file, { ocrEngine: 'ai-vision' })).rejects.toThrow(
        'AI Vision extractor is not initialized in the application registry. Please reload the application.',
      );
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it('throws explicit error when ocrEngine is ai-vision but navigator is offline', async () => {
    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'Scan' }] }),
      getOperatorList: vi.fn().mockResolvedValue({ fnArray: [mockOPS.paintImageXObject] }),
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

    const mockVisionExtractor = {
      extractPageFromDataUrl: vi.fn(),
    };

    const visionImporter = new PdfjsImporter(mockOcrExtractor, mockVisionExtractor as any);

    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() }) as any;

    try {
      const file = new File(['scanned-pdf'], 'scanned.pdf', { type: 'application/pdf' });
      await expect(visionImporter.extract(file, { ocrEngine: 'ai-vision' })).rejects.toThrow(
        'AI Vision extraction requires an active internet connection.',
      );
      expect(mockVisionExtractor.extractPageFromDataUrl).not.toHaveBeenCalled();
      expect(mockOcrExtractor.extractFromBlob).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it('handles 429 rate limit with cooldown progress and retries', async () => {
    const mockPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'Scan' }] }),
      getOperatorList: vi.fn().mockResolvedValue({ fnArray: [mockOPS.paintImageXObject] }),
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

    const rateLimitError = Object.assign(new Error('Rate limited'), {
      code: 'RATE_LIMITED',
      retryAfterSeconds: 0.05, // 50ms for fast test execution
    });

    const extractFn = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({
        pageNumber: 1,
        text: 'Recovered after cooldown',
        confidence: 95,
        source: 'ai-vision',
      });

    const mockVisionExtractor = { extractPageFromDataUrl: extractFn };
    const visionImporter = new PdfjsImporter(mockOcrExtractor, mockVisionExtractor as any, 0);

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() }) as any;
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,mockdata');

    const progressPhases: string[] = [];

    try {
      const file = new File(['scanned-pdf'], 'scanned.pdf', { type: 'application/pdf' });
      const result = await visionImporter.extract(file, {
        ocrEngine: 'ai-vision',
        onProgress: (p) => progressPhases.push(p.phase),
      });

      expect(result.pages[0].text).toBe('Recovered after cooldown');
      expect(extractFn).toHaveBeenCalledTimes(2);
      expect(progressPhases).toContain('cooldown');
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    }
  });

  it('preserves extracted pages and marks isPartial true on abort', async () => {
    const mockPage1 = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'A'.repeat(60) }] }),
      getOperatorList: vi.fn().mockResolvedValue({ fnArray: [] }),
      cleanup: vi.fn(),
    };
    const mockPage2 = {
      getTextContent: vi.fn().mockImplementation(() => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }),
      cleanup: vi.fn(),
    };

    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn().mockImplementation((num: number) => {
          if (num === 1) return Promise.resolve(mockPage1);
          return Promise.resolve(mockPage2);
        }),
      }),
    });

    const file = new File(['multi-page'], 'two_pages.pdf', { type: 'application/pdf' });
    const ac = new AbortController();

    try {
      await importer.extract(file, { signal: ac.signal });
      expect.unreachable('Should have thrown abort error');
    } catch (err: unknown) {
      const partialResult = (err as { partialResult?: any }).partialResult;
      expect(partialResult).toBeDefined();
      expect(partialResult.isPartial).toBe(true);
      expect(partialResult.pages).toHaveLength(1);
      expect(partialResult.pages[0].pageNumber).toBe(1);
    }
  });
});
