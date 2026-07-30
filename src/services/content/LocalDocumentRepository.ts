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

        // Detect Vite SPA fallback — if the dev server returned its index.html
        // instead of the markdown file, treat it as a missing document.
        const contentType = response.headers.get('content-type') ?? '';
        const trimmed = raw.trimStart().toLowerCase();
        if (
            contentType.startsWith('text/html') ||
            trimmed.startsWith('<!doctype html') ||
            trimmed.startsWith('<html')
        ) {
            throw new DocumentNotFoundError(material.sourceId);
        }

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
