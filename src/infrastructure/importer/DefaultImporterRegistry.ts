import type { ContentImporter, ImporterRegistry } from '../../domain/importer/ContentImporter';
import { PdfjsImporter } from './PdfjsImporter';
import { ImageImporter } from './ImageImporter';
import type { TesseractExtractor } from './TesseractExtractor';

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
