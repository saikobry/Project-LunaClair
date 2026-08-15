import type { ImportedDocumentContent } from '../../../domain/reader/DocumentContentRepository';
import type { DocumentContentRepository } from '../../../domain/reader/DocumentContentRepository';
import { db } from '../LunaClairDatabase';

/**
 * Dexie-backed `DocumentContentRepository` — locally imported document markdown,
 * keyed by `documentId`. This is the explicit local representation of an imported
 * material's content; the Service Worker runtime cache is not the source of
 * truth for library membership.
 */
export class DexieDocumentContentRepository implements DocumentContentRepository {
    async getByDocumentId(documentId: string): Promise<ImportedDocumentContent | null> {
        return (await db.documentContents.get(documentId)) ?? null;
    }

    async put(record: ImportedDocumentContent): Promise<void> {
        await db.documentContents.put(record);
    }

    async deleteByDocumentId(documentId: string): Promise<void> {
        await db.documentContents.delete(documentId);
    }
}

/** Singleton instance shared across the application composition root. */
export const dexieDocumentContentRepository = new DexieDocumentContentRepository();
