import type { ContentImporter, ImporterRegistry } from '../../../domain/importer/services/ContentImporter';
import { PdfjsImporter } from '../adapters/PdfjsImporter';
import { ImageImporter } from '../adapters/ImageImporter';
import type { TesseractExtractor } from '../engines/TesseractExtractor';

export function createImporterRegistry(ocrExtractor: TesseractExtractor): ImporterRegistry {
  const importers: ContentImporter[] = [
    new PdfjsImporter(ocrExtractor),
    new ImageImporter(ocrExtractor),
  ];
  return {
    resolve: (file) => importers.find((i) => i.supports(file)),
    importers,
    acceptedTypes: '.pdf,.png,.jpg,.jpeg,.jfif,.heic,.heif,.webp',
  };
}
