import { describe, it, expect, vi } from 'vitest';
import { ImageImporter } from '../ImageImporter';
import type { TesseractExtractor } from '../../engines/TesseractExtractor';

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

  it('delegates extraction directly to ocrExtractor', async () => {
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
  });
});
