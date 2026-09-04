import { describe, it, expect } from 'vitest';
import { createDefaultImporterRegistry, createOcrExtractor } from '../createExtractors';
import { TesseractExtractor } from '../../engines/TesseractExtractor';
import { PdfjsImporter } from '../../adapters/PdfjsImporter';
import { ImageImporter } from '../../adapters/ImageImporter';

describe('createExtractors', () => {
  it('instantiates and returns singleton OCR extractor', () => {
    const extractor = createOcrExtractor();
    expect(extractor).toBeInstanceOf(TesseractExtractor);
  });

  it('instantiates default importer registry with PDF and Image importers wired', () => {
    const registry = createDefaultImporterRegistry();

    expect(registry.importers).toHaveLength(2);
    expect(registry.importers[0]).toBeInstanceOf(PdfjsImporter);
    expect(registry.importers[1]).toBeInstanceOf(ImageImporter);

    const pdfFile = new File(['%PDF-1.5'], 'test.pdf', { type: 'application/pdf' });
    const imageFile = new File(['data'], 'test.png', { type: 'image/png' });

    expect(registry.resolve(pdfFile)).toBe(registry.importers[0]);
    expect(registry.resolve(imageFile)).toBe(registry.importers[1]);
  });
});
