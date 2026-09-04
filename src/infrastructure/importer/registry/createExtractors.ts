import type { ImporterRegistry } from '../../../domain/importer/services/ContentImporter';
import { createImporterRegistry } from './DefaultImporterRegistry';
import { tesseractExtractor, type TesseractExtractor } from '../engines/TesseractExtractor';

export function createOcrExtractor(): TesseractExtractor {
  return tesseractExtractor;
}

export function createDefaultImporterRegistry(): ImporterRegistry {
  return createImporterRegistry(createOcrExtractor());
}
