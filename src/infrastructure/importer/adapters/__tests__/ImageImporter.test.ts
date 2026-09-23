import { describe, it, expect, vi } from 'vitest';
import { ImageImporter } from '../ImageImporter';
import type { TesseractExtractor } from '../../engines/TesseractExtractor';
import type { AiVisionExtractor } from '../../engines/AiVisionExtractor';

describe('ImageImporter', () => {
  it('supports standard image types and extensions', () => {
    const mockOcr = {} as TesseractExtractor;
    const importer = new ImageImporter(mockOcr);

    expect(importer.supports(new File([], 'pic.png', { type: 'image/png' }))).toBe(true);
    expect(importer.supports(new File([], 'pic.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(importer.supports(new File([], 'pic.webp', { type: 'image/webp' }))).toBe(true);
    expect(importer.supports(new File([], 'pic.HEIC', { type: '' }))).toBe(true);
    expect(importer.supports(new File([], 'doc.pdf', { type: 'application/pdf' }))).toBe(false);
  });

  it('delegates extraction directly to ocrExtractor when ocrEngine is undefined or tesseract', async () => {
    const mockResult = {
      text: 'Hello from OCR',
      title: 'photo.png',
      pageCount: 1,
      pages: [],
      stats: { wordCount: 3, characterCount: 14, headingsDetected: 0, ocrPages: 1, textPages: 0 },
    };
    const mockOcr = {
      extract: vi.fn().mockResolvedValue(mockResult),
    } as unknown as TesseractExtractor;

    const importer = new ImageImporter(mockOcr);
    const file = new File(['img-bytes'], 'photo.png', { type: 'image/png' });

    const res = await importer.extract(file);
    expect(res).toEqual(mockResult);
    expect(mockOcr.extract).toHaveBeenCalledWith(file, undefined);

    const resTesseract = await importer.extract(file, { ocrEngine: 'tesseract' });
    expect(resTesseract).toEqual(mockResult);
    expect(mockOcr.extract).toHaveBeenCalledWith(file, { ocrEngine: 'tesseract' });
  });

  it('delegates to visionExtractor when ocrEngine is ai-vision and online', async () => {
    const mockOcr = {
      extract: vi.fn(),
    } as unknown as TesseractExtractor;

    const mockVisionResult = {
      pageNumber: 1,
      text: '# Transcribed Image\n\nContent from image note',
      confidence: 95,
      source: 'ai-vision' as const,
    };

    const mockVision = {
      extractPageFromDataUrl: vi.fn().mockResolvedValue(mockVisionResult),
    } as unknown as AiVisionExtractor;

    const importer = new ImageImporter(mockOcr, mockVision);
    const file = new File(['fake-png-bytes'], 'photo.png', { type: 'image/png' });

    const progressCalls: any[] = [];
    const result = await importer.extract(file, {
      ocrEngine: 'ai-vision',
      onProgress: (p) => progressCalls.push(p),
    });

    expect(result.pageCount).toBe(1);
    expect(result.title).toBe('photo');
    expect(result.text).toBe(mockVisionResult.text);
    expect(result.pages[0].source).toBe('ai-vision');
    expect(result.stats.visionPages).toBe(1);
    expect(result.stats.ocrPages).toBe(0);
    expect(result.stats.wordCount).toBeGreaterThan(0);
    expect(mockVision.extractPageFromDataUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^data:/),
      1,
      expect.anything(),
    );
    expect(progressCalls).toHaveLength(1);
    expect(progressCalls[0].phase).toBe('ai-vision');
    expect(mockOcr.extract).not.toHaveBeenCalled();
  });

  it('throws explicit error when ocrEngine is ai-vision but visionExtractor is missing', async () => {
    const mockOcr = {
      extract: vi.fn(),
    } as unknown as TesseractExtractor;

    const importer = new ImageImporter(mockOcr, undefined);
    const file = new File(['fake-img'], 'photo.png', { type: 'image/png' });

    await expect(importer.extract(file, { ocrEngine: 'ai-vision' })).rejects.toThrow(
      'AI Vision extractor is not initialized in the application registry. Please reload the application.',
    );
    expect(mockOcr.extract).not.toHaveBeenCalled();
  });

  it('throws explicit error when ocrEngine is ai-vision but navigator is offline', async () => {
    const mockOcr = {
      extract: vi.fn(),
    } as unknown as TesseractExtractor;
    const mockVision = {
      extractPageFromDataUrl: vi.fn(),
    } as unknown as AiVisionExtractor;

    const importer = new ImageImporter(mockOcr, mockVision);
    const file = new File(['fake-img'], 'photo.png', { type: 'image/png' });

    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    try {
      await expect(importer.extract(file, { ocrEngine: 'ai-vision' })).rejects.toThrow(
        'AI Vision extraction requires an active internet connection.',
      );
      expect(mockVision.extractPageFromDataUrl).not.toHaveBeenCalled();
      expect(mockOcr.extract).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });

  it('converts file via canvas toDataURL when createImageBitmap and canvas are available', async () => {
    const mockOcr = {} as TesseractExtractor;
    const mockVisionResult = {
      pageNumber: 1,
      text: 'Canvas image text',
      confidence: 95,
      source: 'ai-vision' as const,
    };
    const mockVision = {
      extractPageFromDataUrl: vi.fn().mockResolvedValue(mockVisionResult),
    } as unknown as AiVisionExtractor;

    const importer = new ImageImporter(mockOcr, mockVision);
    const file = new File(['img'], 'photo.png', { type: 'image/png' });

    const originalCreateImageBitmap = globalThis.createImageBitmap;
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

    globalThis.createImageBitmap = vi.fn().mockResolvedValue({ width: 200, height: 150 });
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() }) as any;
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,canvasjpeg');

    try {
      const result = await importer.extract(file, { ocrEngine: 'ai-vision' });
      expect(result.text).toBe('Canvas image text');
      expect(mockVision.extractPageFromDataUrl).toHaveBeenCalledWith(
        'data:image/jpeg;base64,canvasjpeg',
        1,
        expect.anything(),
      );
    } finally {
      globalThis.createImageBitmap = originalCreateImageBitmap;
      HTMLCanvasElement.prototype.getContext = originalGetContext;
      HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    }
  });
});
