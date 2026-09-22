import type { ImporterRegistry } from '../../../domain/importer/services/ContentImporter';
import { createImporterRegistry } from './DefaultImporterRegistry';
import { tesseractExtractor, type TesseractExtractor } from '../engines/TesseractExtractor';
import type { AiVisionExtractor } from '../engines/AiVisionExtractor';

export function createOcrExtractor(): TesseractExtractor {
  return tesseractExtractor;
}

export function createDefaultImporterRegistry(visionExtractor?: AiVisionExtractor): ImporterRegistry {
  return createImporterRegistry(createOcrExtractor(), visionExtractor);
}
