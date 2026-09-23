import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TesseractExtractor } from '../TesseractExtractor';

// Mock tesseract.js
const mockRecognize = vi.fn();
const mockTerminate = vi.fn();
const mockCreateWorker = vi.fn().mockImplementation(async (_lang, _oem, options) => {
  return {
    recognize: mockRecognize,
    terminate: mockTerminate,
    _options: options,
  };
});

vi.mock('tesseract.js', () => ({
  createWorker: (...args: unknown[]) => mockCreateWorker(...args),
}));

describe('TesseractExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes confidence and extracts text result', async () => {
    mockRecognize.mockResolvedValue({
      data: {
        text: 'Extracted OCR content',
        confidence: 85, // 0-100 from tesseract
      },
    });

    const extractor = new TesseractExtractor();
    const file = new File(['dummy-image'], 'scan.png', { type: 'image/png' });

    const result = await extractor.extract(file);

    expect(result.text).toBe('Extracted OCR content');
    expect(result.title).toBe('scan');
    expect(result.pageCount).toBe(1);
    expect(result.pages[0].confidence).toBe(0.85); // 85 / 100
    expect(result.pages[0].source).toBe('ocr');
    expect(result.stats.wordCount).toBe(3);
  });

  it('honors abort signal by throwing Aborted error', async () => {
    const extractor = new TesseractExtractor();
    const file = new File(['dummy-image'], 'scan.png', { type: 'image/png' });

    const controller = new AbortController();
    controller.abort();

    await expect(extractor.extract(file, { signal: controller.signal })).rejects.toThrow('Aborted');
  });
});
