/**
 * Locally imported document content (markdown), keyed by `sourceId`.
 *
 * This is the explicit local representation of an imported material's content —
 * the Service Worker runtime cache remains a network-resource cache and is not
 * the source of truth for library membership.
 */
export interface ImportedDocumentContent {
  sourceId: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface DocumentContentRepository {
  getBySourceId(sourceId: string, signal?: AbortSignal): Promise<ImportedDocumentContent | null>;
  put(record: ImportedDocumentContent): Promise<void>;
  deleteBySourceId(sourceId: string): Promise<void>;
}
