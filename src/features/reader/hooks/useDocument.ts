import { useQuery } from '@tanstack/react-query';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import { readerQueryKeys } from '../queries/readerQueryKeys';
import { useDocumentRepository } from './useDocumentRepository';

/**
 * Query hook for resolving a Document from a StudyMaterial.
 * Fetches and caches the document content keyed by material ID.
 */
export function useDocument(material: StudyMaterial | null) {
    const documentRepository = useDocumentRepository();

    return useQuery({
        queryKey: readerQueryKeys.document(material?.id ?? 'none'),
        queryFn: ({ signal }) => documentRepository.getDocumentByMaterial(material!, signal),
        enabled: material !== null,
    });
}
