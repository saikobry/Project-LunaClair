import { useQuery } from '@tanstack/react-query';
import type { StudyMaterial } from '../../../../../domain/library';
import { catalogQueryKeys } from '../../../queries/catalogQueryKeys';
import { useContextOrThrow } from '../../../../../shared/utils/contextGuard';
import { ApplicationContext } from '../../../../../app/providers/ApplicationContext';

/**
 * Query hook resolving the Document for the **read-only preview** surface.
 *
 * Uses the same `DocumentRepository` as the reader (`HybridDocumentRepository`
 * in the composition root): locally imported content is served from Dexie,
 * otherwise fetched from `GET /api/documents/{documentId}` (SW runtime-cached).
 * Preview keying lives under the remote material resolution key so it never
 * collides with the local reader's document cache.
 */
export function usePreviewDocument(material: StudyMaterial | null) {
  const context = useContextOrThrow(ApplicationContext, 'usePreviewDocument');

  return useQuery({
    queryKey: [...catalogQueryKeys.availableMaterial(material?.id ?? ''), 'document'],
    queryFn: ({ signal }) => context.documentRepository.getDocumentByMaterial(material!, signal),
    enabled: material !== null,
  });
}
