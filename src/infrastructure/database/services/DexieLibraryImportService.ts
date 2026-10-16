import type { LibraryImportService } from '../../../domain/library/services/LibraryImportService';
import type { SyncQueueItem } from '../../../domain/sync/models/sync.types';
import { DexieFlashcardReviewRepository } from '../repositories/DexieFlashcardReviewRepository';
import { getActiveVaultDatabase, type LunaClairDatabase } from '../schema/LunaClairDatabase';

/**
 * Concrete `LibraryImportService` backed by Dexie.
 *
 * **Removal only.** The `importMaterial` / `importMaterialBatch` methods were
 * deleted in Sep 2026: no production caller remained after the catalog-era
 * import use cases were removed, and they wrote to `db.questions` with no
 * payload validator — the one ungated write surface left in a codebase where
 * every live ingress runs `validateQuestionPayload`. Library population goes
 * through `DexieStudyPackageImportService` (cloned share / imported `.lcpack`,
 * which validates) and the importer use cases; nothing here creates content.
 *
 * `removeMaterial` executes a multi-device deletion cascade in one atomic
 * transaction:
 * - Hard-deletes non-synced local rows: `materials`, `questions`, `quizzes`,
 *   `localAssets` (stored binary blobs), and `collectionMaterials` junction rows.
 * - Multi-device syncable entities (`documentContents`, `highlights`, `drawings`):
 *   stamps with `deletedAt` / `updatedAt` and enqueues `DELETE` outbox mutations
 *   into `syncQueue` so deletions propagate across all synced user devices.
 * - `flashcardReviews` schedules are cleared and tombstoned in `syncQueue` via
 *   `DexieFlashcardReviewRepository.deleteByKeys`.
 *
 * Asset removal lives here rather than on the importer's write port so it commits
 * atomically with the rest of the removal; a non-atomic delete would leave
 * orphaned blobs behind if the material delete succeeded and it failed.
 * Collection membership is cleared here for the same reason: a stale junction
 * row keeps inflating a collection's count and keeps the material out of the
 * Library's `uncollected` lens even though it no longer exists.
 *
 * This is the single removal contract — `LibraryRepository` has no delete method,
 * so nothing can remove a material row without its dependents.
 */
export class DexieLibraryImportService implements LibraryImportService {
    private readonly db: LunaClairDatabase;
    private readonly flashcardReviews: DexieFlashcardReviewRepository;

    constructor(db: LunaClairDatabase = getActiveVaultDatabase()) {
        this.db = db;
        this.flashcardReviews = new DexieFlashcardReviewRepository(db);
    }

    async removeMaterial(materialId: string): Promise<void> {
        await this.db.transaction(
            'rw',
            [
                this.db.materials,
                this.db.questions,
                this.db.quizzes,
                this.db.documentContents,
                this.db.localAssets,
                this.db.collectionMaterials,
                this.db.flashcardReviews,
                this.db.highlights,
                this.db.drawings,
                this.db.syncQueue,
            ],
            async () => {
                const material = await this.db.materials.get(materialId);
                const nowIso = new Date().toISOString();

                // 1. Hard-delete non-synced local rows
                await this.db.materials.delete(materialId);

                const questions = await this.db.questions.where('materialId').equals(materialId).toArray();
                if (questions.length > 0) await this.db.questions.bulkDelete(questions.map((q) => q.id));

                const quizzes = await this.db.quizzes.where('materialId').equals(materialId).toArray();
                if (quizzes.length > 0) await this.db.quizzes.bulkDelete(quizzes.map((z) => z.id));

                // Collection membership goes with the material — its junction rows are keyed by the
                // `materialId` index, so every collection it was filed into is cleared.
                await this.db.collectionMaterials.where('materialId').equals(materialId).delete();

                // Binary assets go with the material — keyed by the `materialId` index, so a
                // cloned material's N package figures are removed alongside its imported file.
                await this.db.localAssets.where('materialId').equals(materialId).delete();

                // 2. Multi-device synced entities: documentContents, highlights, drawings
                const queueItemsToPut: SyncQueueItem[] = [];

                if (material?.documentId) {
                    const documentId = material.documentId;
                    const existingDoc = await this.db.documentContents.get(documentId);
                    const baseVersion = existingDoc?.version ?? 0;
                    const nextVersion = baseVersion + 1;

                    // Stamp documentContents: updatedAt & deletedAt
                    await this.db.documentContents.put({
                        ...(existingDoc ?? {
                            documentId,
                            title: material.title ?? '',
                            content: '',
                        }),
                        updatedAt: nowIso,
                        deletedAt: nowIso,
                        version: nextVersion,
                    });

                    // Enqueue outbox mutation in syncQueue (DELETE document)
                    queueItemsToPut.push({
                        id: crypto.randomUUID(),
                        clientMutationId: crypto.randomUUID(),
                        entityType: 'document',
                        entityId: documentId,
                        operation: 'DELETE',
                        baseVersion,
                        clientTimestamp: nowIso,
                        payload: {
                            documentId,
                            title: existingDoc?.title ?? material.title ?? '',
                            content: existingDoc?.content ?? '',
                            updatedAt: nowIso,
                            deletedAt: nowIso,
                            version: nextVersion,
                        },
                        status: 'pending',
                        createdAt: nowIso,
                        retryCount: 0,
                    });

                    // Stamp all active highlights for documentId and enqueue DELETE mutations
                    const highlights = await this.db.highlights.where('documentId').equals(documentId).toArray();
                    const activeHighlights = highlights.filter((h) => h.deletedAt == null);
                    if (activeHighlights.length > 0) {
                        await this.db.highlights.bulkPut(
                            activeHighlights.map((h) => ({
                                ...h,
                                deletedAt: nowIso,
                                updatedAt: nowIso,
                            }))
                        );
                        for (const h of activeHighlights) {
                            queueItemsToPut.push({
                                id: crypto.randomUUID(),
                                clientMutationId: crypto.randomUUID(),
                                entityType: 'highlight',
                                entityId: h.id,
                                operation: 'DELETE',
                                clientTimestamp: nowIso,
                                payload: {
                                    id: h.id,
                                    documentId,
                                    start: h.start,
                                    end: h.end,
                                    color: h.color,
                                    text: h.text,
                                    createdAt: h.createdAt,
                                    updatedAt: nowIso,
                                    deletedAt: nowIso,
                                },
                                status: 'pending',
                                createdAt: nowIso,
                                retryCount: 0,
                            });
                        }
                    }

                    // Stamp all active drawings for documentId and enqueue DELETE mutations
                    const drawings = await this.db.drawings.where('documentId').equals(documentId).toArray();
                    const activeDrawings = drawings.filter((d) => d.deletedAt == null);
                    if (activeDrawings.length > 0) {
                        await this.db.drawings.bulkPut(
                            activeDrawings.map((d) => ({
                                ...d,
                                deletedAt: nowIso,
                                updatedAt: nowIso,
                            }))
                        );
                        for (const d of activeDrawings) {
                            queueItemsToPut.push({
                                id: crypto.randomUUID(),
                                clientMutationId: crypto.randomUUID(),
                                entityType: 'drawing',
                                entityId: d.id,
                                operation: 'DELETE',
                                clientTimestamp: nowIso,
                                payload: {
                                    id: d.id,
                                    documentId,
                                    color: d.color,
                                    thickness: d.thickness,
                                    points: d.points,
                                    isEraser: d.isEraser,
                                    createdAt: d.createdAt,
                                    updatedAt: nowIso,
                                    deletedAt: nowIso,
                                },
                                status: 'pending',
                                createdAt: nowIso,
                                retryCount: 0,
                            });
                        }
                    }
                }

                if (queueItemsToPut.length > 0) {
                    await this.db.syncQueue.bulkPut(queueItemsToPut);
                }

                // 3. Spaced-repetition schedules go with the material's questions. Keyed by the
                // `materialId` index, so this reaches every card key of every question in the
                // material — whole-question `q:<id>` keys and per-blank `q:<id>#<n>` keys alike.
                const reviews = await this.db.flashcardReviews
                    .where('materialId')
                    .equals(materialId)
                    .toArray();
                const reviewKeys = reviews
                    .filter((r) => (r as { deletedAt?: string | null }).deletedAt == null)
                    .map((r) => r.key);
                await this.flashcardReviews.deleteByKeys(reviewKeys);
            },
        );
    }
}

export const dexieLibraryImportService = new DexieLibraryImportService();
