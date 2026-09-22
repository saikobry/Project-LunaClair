import type { ContentImporter, ImporterRegistry } from '../../../domain/importer/services/ContentImporter';
import { PdfjsImporter } from '../adapters/PdfjsImporter';
import { ImageImporter } from '../adapters/ImageImporter';
import type { TesseractExtractor } from '../engines/TesseractExtractor';
import type { AiVisionExtractor } from '../engines/AiVisionExtractor';

export function createImporterRegistry(
  ocrExtractor: TesseractExtractor,
  visionExtractor?: AiVisionExtractor,
): ImporterRegistry {
  const importers: ContentImporter[] = [
    new PdfjsImporter(ocrExtractor, visionExtractor),
    new ImageImporter(ocrExtractor, visionExtractor),
  ];
  return {
    resolve: (file) => importers.find((i) => i.supports(file)),
    importers,
    acceptedTypes: '.pdf,.png,.jpg,.jpeg,.jfif,.heic,.heif,.webp',
  };
}
