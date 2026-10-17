import type { ImportedDocumentContent } from '../../../domain/reader/repositories/DocumentContentRepository';
import type { DocumentContentRepository } from '../../../domain/reader/repositories/DocumentContentRepository';
import { getActiveVaultDatabase, type LunaClairDatabase } from '../schema/LunaClairDatabase';
import { withOrigin } from '../sync/transactionContext';

/**
 * Dexie-backed `DocumentContentRepository` — locally imported document markdown,
 * keyed by `documentId`. This is the explicit local representation of an imported
 * material's content; the Service Worker runtime cache is not the source of
 * truth for library membership.
 */
export class DexieDocumentContentRepository implements DocumentContentRepository {
    private readonly db: LunaClairDatabase;

    constructor(database: LunaClairDatabase = getActiveVaultDatabase()) {
        this.db = database;
    }

    async getByDocumentId(documentId: string): Promise<ImportedDocumentContent | null> {
        return (await this.db.documentContents.get(documentId)) ?? null;
    }

    async put(record: ImportedDocumentContent): Promise<void> {
        const existing = await this.db.documentContents.get(record.documentId);
        const baseVersion = existing?.version ?? 0;
        const nextVersion = baseVersion + 1;
        const updatedRecord: ImportedDocumentContent = {
            ...record,
            version: nextVersion,
        };

        await withOrigin(
            this.db,
            'local',
            [this.db.documentContents, this.db.syncQueue, this.db.tombstones],
            async () => {
                await this.db.documentContents.put(updatedRecord);
            }
        );
    }

    async deleteByDocumentId(documentId: string): Promise<void> {
        await withOrigin(
            this.db,
            'local',
            [this.db.documentContents, this.db.syncQueue, this.db.tombstones],
            async () => {
                await this.db.documentContents.delete(documentId);
            }
        );
    }
}

/** Singleton instance shared across the application composition root. */
export const dexieDocumentContentRepository = new DexieDocumentContentRepository();
