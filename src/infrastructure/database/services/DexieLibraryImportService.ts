import type { LibraryImportService } from '../../../domain/library/services/LibraryImportService';
import { DexieFlashcardReviewRepository } from '../repositories/DexieFlashcardReviewRepository';
import { db as defaultDb, type LunaClairDatabase } from '../schema/LunaClairDatabase';

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
 * `removeMaterial` deletes the material row, its questions/quizzes, its
 * document content, its `collectionMaterials` junction rows, every stored
 * binary asset of the material (`localAssets` — the imported original file plus
 * any package-imported figures), and its **`flashcardReviews` schedules** in one
 * transaction. Asset removal lives here rather than on the importer's write port
 * so it commits atomically with the rest of the removal; a non-atomic delete
 * would leave orphaned blobs behind if the material delete succeeded and it
 * failed. Collection membership is cleared here for the same reason: a stale
 * junction row keeps inflating a collection's count and keeps the material out
 * of the Library's `uncollected` lens even though it no longer exists.
 *
 * Removing a material removes its questions, and a question's cards are the
 * only thing that projects its review keys — so the schedules go too. They are
 * deleted through `FlashcardReviewRepository.deleteByKeys` (tombstoned in the
 * same transaction, for the same reason: a local-only clear is resurrected by
 * the next pull), and the review keys come from the `materialId` index, which
 * reaches every key of every question in the material including per-blank ones.
 *
 * This is the single removal contract — `LibraryRepository` has no delete method,
 * so nothing can remove a material row without its dependents.
 */
export class DexieLibraryImportService implements LibraryImportService {
    private readonly db: LunaClairDatabase;
    private readonly flashcardReviews: DexieFlashcardReviewRepository;

    constructor(db: LunaClairDatabase = defaultDb) {
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
                // Removing a material removes its questions, so its review
                // schedules go with them — inside THIS transaction, and with
                // their tombstones, so the clear cannot be undone by a pull.
                this.db.flashcardReviews,
                this.db.syncQueue,
            ],
            async () => {
                const material = await this.db.materials.get(materialId);
                await this.db.materials.delete(materialId);

                const questions = await this.db.questions.where('materialId').equals(materialId).toArray();
                if (questions.length > 0) await this.db.questions.bulkDelete(questions.map((q) => q.id));

                const quizzes = await this.db.quizzes.where('materialId').equals(materialId).toArray();
                if (quizzes.length > 0) await this.db.quizzes.bulkDelete(quizzes.map((z) => z.id));

                if (material?.documentId) await this.db.documentContents.delete(material.documentId);

                // Collection membership goes with the material — its junction rows are keyed by the
                // `materialId` index, so every collection it was filed into is cleared. Leaving them
                // would keep the material counted as assigned while it no longer exists.
                await this.db.collectionMaterials.where('materialId').equals(materialId).delete();

                // Binary assets go with the material — keyed by the `materialId` index, so a
                // cloned material's N package figures are removed alongside its imported file.
                // Leaving them would strand blobs in IndexedDB that nothing references.
                await this.db.localAssets.where('materialId').equals(materialId).delete();

                // Spaced-repetition schedules go with the material's questions. Keyed by the
                // `materialId` index, so this reaches every card key of every question in the
                // material — whole-question `q:<id>` keys and per-blank `q:<id>#<n>` keys alike.
                const reviewKeys = await this.db.flashcardReviews
                    .where('materialId')
                    .equals(materialId)
                    .primaryKeys();
                await this.flashcardReviews.deleteByKeys(reviewKeys);
            },
        );
    }
}

export const dexieLibraryImportService = new DexieLibraryImportService();
