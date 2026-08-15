import type { StudyMaterial } from '../../domain/library';
import type { Document } from '../../domain/reader';
import type { DocumentRepository } from '../../domain/reader/DocumentRepository';
import { DocumentNotFoundError } from '../../domain/reader/DocumentNotFoundError';
import { preprocessMarkdown } from './markdownPreprocessor';

interface DocumentApiResponse {
    id: string;
    title: string;
    content: string;
}

/**
 * Concrete implementation of `DocumentRepository` that resolves study materials
 * from the LunaClair API (`/api/documents/{documentId}`).
 *
 * Requests are proxied in dev (Vite proxy) and production (Cloudflare Pages `_redirects`),
 * and cached offline by the service worker via Workbox `CacheFirst`.
 */
export class ApiDocumentRepository implements DocumentRepository {
    async getDocumentByMaterial(
        material: StudyMaterial,
        signal?: AbortSignal,
    ): Promise<Document> {
        const url = `/api/documents/${encodeURIComponent(material.documentId)}`;

        let response: Response;
        try {
            response = await fetch(url, { signal });
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') throw err;
            throw new DocumentNotFoundError(material.documentId);
        }

        if (!response.ok) {
            throw new DocumentNotFoundError(material.documentId);
        }

        let data: DocumentApiResponse;
        try {
            data = (await response.json()) as DocumentApiResponse;
        } catch {
            throw new DocumentNotFoundError(material.documentId);
        }

        return {
            id: material.id,
            title: data.title || material.title,
            content: preprocessMarkdown(data.content, material.documentId),
            format: 'markdown',
        };
    }
}

/** Singleton instance shared across the application composition root. */
export const apiDocumentRepository = new ApiDocumentRepository();
