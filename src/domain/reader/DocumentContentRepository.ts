/**
 * Locally imported document content (markdown), keyed by `documentId`.
 *
 * This is the explicit local representation of an imported material's content —
 * the Service Worker runtime cache remains a network-resource cache and is not
 * the source of truth for library membership.
 */
export interface ImportedDocumentContent {
  documentId: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface DocumentContentRepository {
  getByDocumentId(documentId: string, signal?: AbortSignal): Promise<ImportedDocumentContent | null>;
  put(record: ImportedDocumentContent): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<void>;
}
