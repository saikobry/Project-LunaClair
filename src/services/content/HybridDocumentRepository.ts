import type { StudyMaterial } from '../../domain/library/StudyMaterial';
import type { Document } from '../../domain/reader/Document';
import type { DocumentRepository } from '../../domain/reader/DocumentRepository';
import type { DocumentContentRepository } from '../../domain/reader/DocumentContentRepository';

/**
 * `DocumentRepository` that serves imported document content from Dexie first
 * and falls back to the remote API.
 *
 * Imported materials are read fully from local data (offline-capable) —
 * figures remain behind the service worker runtime cache. Unimported
 * materials fall through to the API-backed repository, which is served via
 * Workbox `CacheFirst`.
 */
export class HybridDocumentRepository implements DocumentRepository {
    private readonly local: DocumentContentRepository;
    private readonly remote: DocumentRepository;

    constructor(local: DocumentContentRepository, remote: DocumentRepository) {
        this.local = local;
        this.remote = remote;
    }

    async getDocumentByMaterial(
        material: StudyMaterial,
        signal?: AbortSignal,
    ): Promise<Document> {
        const imported = await this.local.getBySourceId(material.sourceId, signal);
        if (imported) {
            return {
                id: material.id,
                title: imported.title,
                content: imported.content,
                format: 'markdown',
            };
        }
        return this.remote.getDocumentByMaterial(material, signal);
    }
}
