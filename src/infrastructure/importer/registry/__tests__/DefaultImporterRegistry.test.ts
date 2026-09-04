import { describe, it, expect } from 'vitest';
import { createImporterRegistry } from '../DefaultImporterRegistry';
import type { TesseractExtractor } from '../../engines/TesseractExtractor';

describe('DefaultImporterRegistry', () => {
  const mockOcrExtractor = {} as TesseractExtractor;
  const registry = createImporterRegistry(mockOcrExtractor);

  it('exposes acceptedTypes list for file pickers', () => {
    expect(registry.acceptedTypes).toContain('.pdf');
    expect(registry.acceptedTypes).toContain('.png');
    expect(registry.acceptedTypes).toContain('.jpg');
  });

  it('resolves PDF importer for PDF files by extension or mime type', () => {
    const pdfByMime = new File(['%PDF-1.5'], 'document.bin', { type: 'application/pdf' });
    const pdfByExt = new File(['%PDF-1.5'], 'my-notes.pdf', { type: 'application/octet-stream' });

    const importer1 = registry.resolve(pdfByMime);
    const importer2 = registry.resolve(pdfByExt);

    expect(importer1).toBeDefined();
    expect(importer1?.formatLabel).toBe('PDF Document');
    expect(importer2).toBeDefined();
    expect(importer2?.formatLabel).toBe('PDF Document');
  });

  it('resolves Image importer for image files by extension or mime type', () => {
    const pngFile = new File(['fake-png'], 'figure.png', { type: 'image/png' });
    const jpegFile = new File(['fake-jpg'], 'photo.jpeg', { type: 'image/jpeg' });
    const webpFile = new File(['fake-webp'], 'image.webp', { type: 'image/webp' });

    expect(registry.resolve(pngFile)?.formatLabel).toBe('Image (OCR)');
    expect(registry.resolve(jpegFile)?.formatLabel).toBe('Image (OCR)');
    expect(registry.resolve(webpFile)?.formatLabel).toBe('Image (OCR)');
  });

  it('returns undefined for unsupported file types', () => {
    const textFile = new File(['plain text'], 'readme.txt', { type: 'text/plain' });
    const zipFile = new File(['zip data'], 'archive.zip', { type: 'application/zip' });
    const unknownFile = new File(['unknown'], 'unknown.xyz', { type: 'application/octet-stream' });

    expect(registry.resolve(textFile)).toBeUndefined();
    expect(registry.resolve(zipFile)).toBeUndefined();
    expect(registry.resolve(unknownFile)).toBeUndefined();
  });
});
