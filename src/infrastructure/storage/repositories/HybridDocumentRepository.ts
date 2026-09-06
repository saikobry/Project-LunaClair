import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { Document } from '../../../domain/reader/models/Document';
import type { DocumentRepository } from '../../../domain/reader/repositories/DocumentRepository';
import type { DocumentContentRepository } from '../../../domain/reader/repositories/DocumentContentRepository';

/**
 * `DocumentRepository` that serves document content from local Dexie storage.
 *
 * All materials are resolved fully from local data (offline-capable).
 * If a material has not yet had content authored or imported, an empty
 * document is returned to enable the authoring/reading empty state.
 */
export class HybridDocumentRepository implements DocumentRepository {
    private readonly local: DocumentContentRepository;

    constructor(local: DocumentContentRepository) {
        this.local = local;
    }

    async getDocumentByMaterial(
        material: StudyMaterial,
        signal?: AbortSignal,
    ): Promise<Document> {
        const imported = await this.local.getByDocumentId(material.documentId, signal);
        if (imported) {
            return {
                id: material.id,
                title: imported.title,
                content: imported.content,
                format: 'markdown',
            };
        }

        return {
            id: material.id,
            title: material.title,
            content: '',
            format: 'markdown',
        };
    }
}
