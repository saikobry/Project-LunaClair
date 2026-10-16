import type {
  StudyPackageImportService,
  ImportStudyPackageRecords,
} from '../../../domain/package/services/StudyPackageImportService';
import { base64ToBlob } from '../../../domain/package/engines/StudyPackageSerializer';
import { getActiveVaultDatabase, type LunaClairDatabase } from '../schema/LunaClairDatabase';
import type { StoredAsset } from '../../../domain/assets/repositories/AssetRepository';
import { FLOOR_ISO } from '../../../domain/sync/utils/hlc';
import type { SyncQueueItem } from '../../../domain/sync/models/sync.types';
import type { ImportedDocumentContent } from '../../../domain/reader/repositories/DocumentContentRepository';

/**
 * Dexie implementation of `StudyPackageImportService`.
 *
 * Coordinates atomic multi-table commit across `materials`, `documentContents`,
 * `questions`, `quizzes`, `localAssets`, `syncQueue`, `highlights`, and `drawings`
 * inside a single Dexie transaction.
 *
 * Implements the Three-Mode Clone State Machine for `documentContents`:
 * - Mode 1 (Cold Clone): document does not exist yet. Pinned to FLOOR_ISO, deletedAt: null, no sync outbox.
 * - Mode 2 (Preserved Hydration): document exists and is not deleted.
 *   - Branch A: user has local edits (updatedAt > FLOOR_ISO) -> preserves content & updatedAt.
 *   - Branch B: unmodified template (updatedAt === FLOOR_ISO) -> updates content/title at FLOOR_ISO.
 * - Mode 3 (Tombstone Resurrection): document was previously soft-deleted (deletedAt != null).
 *   - Revives document with current timestamp, clears deletedAt, enqueues UPSERT to syncQueue.
 *   - Sweeps lingering un-tombstoned highlights & drawings for documentId.
 */
export class DexieStudyPackageImportService implements StudyPackageImportService {
  private readonly db: LunaClairDatabase;

  constructor(db: LunaClairDatabase = getActiveVaultDatabase()) {
    this.db = db;
  }

  async importStudyPackage(records: ImportStudyPackageRecords): Promise<void> {
    const assetRecords: StoredAsset[] = records.assets.map((asset) => ({
      // `assetId` is the identity the imported documentContent references; `materialId` only
      // groups the asset under the material it was packaged with.
      assetId: asset.assetId,
      materialId: asset.materialId,
      blob: base64ToBlob(asset.dataBase64, asset.mimeType),
      mimeType: asset.mimeType,
      filename: asset.filename,
      importedAt: asset.importedAt,
    }));

    await this.db.transaction(
      'rw',
      [
        this.db.materials,
        this.db.documentContents,
        this.db.questions,
        this.db.quizzes,
        this.db.localAssets,
        this.db.syncQueue,
        this.db.highlights,
        this.db.drawings,
      ],
      async () => {
        if (records.materials.length > 0) {
          await this.db.materials.bulkPut(records.materials);
        }

        for (const doc of records.documentContents) {
          const existingDoc = await this.db.documentContents.get(doc.documentId);

          if (existingDoc == null) {
            // Mode 1: Cold Clone
            await this.db.documentContents.put({
              ...doc,
              updatedAt: doc.updatedAt || FLOOR_ISO,
              deletedAt: null,
            });
            // Do NOT write to syncQueue
          } else if (!existingDoc.deletedAt) {
            // Mode 2: Preserved Hydration
            if (existingDoc.updatedAt && existingDoc.updatedAt > FLOOR_ISO) {
              // User has edited the course locally or received edits via sync:
              // Do NOT overwrite content or updatedAt of documentContents! Keep the user's edits.
              await this.db.documentContents.put({
                ...existingDoc,
                title: doc.title,
              });
            } else {
              // existingDoc.updatedAt === FLOOR_ISO: safe to update content and title without advancing timestamp past FLOOR_ISO
              await this.db.documentContents.put({
                ...existingDoc,
                title: doc.title,
                content: doc.content,
                updatedAt: FLOOR_ISO,
                deletedAt: null,
              });
            }
            // Do NOT write to syncQueue
          } else {
            // Mode 3: Tombstone Resurrection (existingDoc != null && existingDoc.deletedAt != null)
            const resurrectionIso = new Date().toISOString();
            const baseVersion = existingDoc.version ?? 0;
            const nextVersion = baseVersion + 1;
            const resurrectedDoc: ImportedDocumentContent = {
              ...existingDoc,
              title: doc.title,
              content: doc.content,
              updatedAt: resurrectionIso,
              deletedAt: null,
              version: nextVersion,
            };
            await this.db.documentContents.put(resurrectedDoc);

            // Enqueue an outbox record in syncQueue
            const queueItem: SyncQueueItem = {
              id: crypto.randomUUID(),
              clientMutationId: crypto.randomUUID(),
              entityType: 'document',
              entityId: doc.documentId,
              operation: 'UPSERT',
              baseVersion,
              clientTimestamp: resurrectionIso,
              payload: {
                documentId: doc.documentId,
                title: doc.title,
                content: doc.content,
                updatedAt: resurrectionIso,
                version: nextVersion,
              },
              status: 'pending',
              createdAt: resurrectionIso,
              retryCount: 0,
            };
            await this.db.syncQueue.add(queueItem);

            // Tomb-sweep lingering un-tombstoned highlights and drawings for documentId
            const highlights = await this.db.highlights.where('documentId').equals(doc.documentId).toArray();
            const unTombstonedHighlights = highlights.filter((h) => !h.deletedAt);
            if (unTombstonedHighlights.length > 0) {
              await this.db.highlights.bulkPut(
                unTombstonedHighlights.map((h) => ({
                  ...h,
                  deletedAt: resurrectionIso,
                  updatedAt: resurrectionIso,
                }))
              );
            }

            const drawings = await this.db.drawings.where('documentId').equals(doc.documentId).toArray();
            const unTombstonedDrawings = drawings.filter((d) => !d.deletedAt);
            if (unTombstonedDrawings.length > 0) {
              await this.db.drawings.bulkPut(
                unTombstonedDrawings.map((d) => ({
                  ...d,
                  deletedAt: resurrectionIso,
                  updatedAt: resurrectionIso,
                }))
              );
            }
          }
        }

        if (records.questions.length > 0) {
          await this.db.questions.bulkPut(records.questions);
        }
        if (records.quizzes.length > 0) {
          await this.db.quizzes.bulkPut(records.quizzes);
        }
        if (assetRecords.length > 0) {
          await this.db.localAssets.bulkPut(assetRecords);
        }
      },
    );
  }
}
