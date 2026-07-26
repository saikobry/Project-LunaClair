import type { StudyMaterial } from '../../domain/library';
import type { Document } from '../../domain/reader';
import type { DocumentRepository } from '../../domain/reader/DocumentRepository';
import { DocumentNotFoundError } from '../../domain/reader/DocumentNotFoundError';
import { preprocessMarkdown } from './markdownPreprocessor';

export class LocalDocumentRepository implements DocumentRepository {
    async getDocumentByMaterial(
        material: StudyMaterial,
        signal?: AbortSignal,
    ): Promise<Document> {
        const url = `/materials/${material.sourceId}/index.md`;

        let response: Response;
        try {
            response = await fetch(url, { signal });
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') throw err;
            throw new DocumentNotFoundError(material.sourceId);
        }

        if (!response.ok) {
            throw new DocumentNotFoundError(material.sourceId);
        }

        const raw = await response.text();

        return {
            id: material.id,
            title: material.title,
            content: preprocessMarkdown(raw, material.sourceId),
            format: 'markdown',
        };
    }
}

/** Singleton instance shared across the application. */
export const localDocumentRepository = new LocalDocumentRepository();
