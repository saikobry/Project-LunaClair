import Dexie, { type Table } from 'dexie';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { Question } from '../../../domain/quiz/models/Question';
import type { Quiz } from '../../../domain/quiz/models/Quiz';
import type { QuizSession } from '../../../domain/quiz/models/QuizSession';
import type { HighlightItem, DrawingPath } from '../../../domain/reader/models/annotation.types';
import type { QuizDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import type { ReviewState } from '../../../domain/flashcards/engines/scheduler';
import type { ImportedDocumentContent } from '../../../domain/reader/repositories/DocumentContentRepository';
import type { AiThread, AiMessageRecord } from '../../../domain/ai/models/ai.types';
import type { SyncQueueItem, SyncState, ConflictDraft } from '../../../domain/sync/models/sync.types';
import type { Collection } from '../../../domain/collections/models/Collection';
import type { CollectionMaterial } from '../../../domain/collections/models/CollectionMaterial';
import type { StoredAsset } from '../../../domain/assets/repositories/AssetRepository';
import { DB_NAME, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8, SCHEMA_V9, SCHEMA_V10, SCHEMA_V11, SCHEMA_V12, SCHEMA_V13, SCHEMA_V14 } from './schema';

/** Row shape for the highlights store (adds documentId + createdAt for indexing). */
export interface HighlightRecord extends HighlightItem {
    documentId: string;
    createdAt: string;
}

/** Row shape for the drawings store (adds documentId + createdAt for indexing). */
export interface DrawingRecord extends DrawingPath {
    documentId: string;
    createdAt: string;
}

/** Row shape for the preferences store. */
export interface PreferenceRecord {
    key: string;
    value: unknown;
}

/** Row shape for the metadata store. */
export interface MetadataRecord {
    key: string;
    value: unknown;
}

/**
 * Dexie subclass defining the LunaClair IndexedDB database.
 * Version 1: Phase 5 stores.
 * Version 2: Phase 5.3 — adds subjects, terms tables; widens materials.
 * Version 3: Normalizes Subject↔Term relationship — adds subjectTerms junction,
 *            removes subjectId and order from terms (terms become global).
 * Version 4: Adds quizEditingDrafts — local crash-recovery store for the
 *            quiz canvas authoring session (autosaved QuizDraft DTOs).
 * Version 5: Adds flashcardReviews — spaced-repetition review states per card.
 * Version 6: Adds documentContents — locally imported document markdown.
 * Version 7: Drops the legacy `sourceType` index from materials.
 * Version 8: Rekeys documentContents from `sourceId` to `documentId`. Declared only — see the
 *            `version(8)` note: no data migration can run for a primary-key change.
 * Version 9: Adds aiThreads and aiMessages for local-first AI chat persistence.
 * Version 10: Adds importAssets table for raw uploaded files.
 * Version 11: Adds syncQueue, syncState, and conflictDrafts for Phase 10 Cloud Synchronization.
 * Version 12: Adds the originShareId index on materials for exact clone identity.
 * Version 13: Adds collections + collectionMaterials (Playlist model) and the
 *            `*tags` multi-entry index on materials. Sunset: drops the
 *            obsolete `subjects`, `terms`, and `subjectTerms` tables and the
 *            `subjectId`/`termId` materials indexes.
 * Version 14: Rekeys local binary assets from `importAssets` (one blob per
 *            `materialId`) to `localAssets` (keyed by `assetId`, indexed by
 *            `materialId`). The upgrade copies legacy rows across, keeping
 *            `assetId === materialId` so old `lc-asset://{materialId}` references
 *            still resolve.
 */
export class LunaClairDatabase extends Dexie {
    materials!: Table<StudyMaterial, string>;
    questions!: Table<Question, string>;
    quizzes!: Table<Quiz, string>;
    quizSessions!: Table<QuizSession, string>;
    highlights!: Table<HighlightRecord, string>;
    drawings!: Table<DrawingRecord, string>;
    preferences!: Table<PreferenceRecord, string>;
    metadata!: Table<MetadataRecord, string>;
    quizEditingDrafts!: Table<QuizDraft, string>;
    flashcardReviews!: Table<ReviewState, string>;
    documentContents!: Table<ImportedDocumentContent, string>;
    aiThreads!: Table<AiThread, string>;
    aiMessages!: Table<AiMessageRecord, string>;
    localAssets!: Table<StoredAsset, string>;
    syncQueue!: Table<SyncQueueItem, string>;
    syncState!: Table<SyncState, string>;
    conflictDrafts!: Table<ConflictDraft, string>;
    collections!: Table<Collection, string>;
    collectionMaterials!: Table<CollectionMaterial, number>;

    constructor(databaseName = DB_NAME) {
        super(databaseName);
        this.version(1).stores(SCHEMA_V1);
        this.version(2).stores(SCHEMA_V2);
        this.version(3).stores(SCHEMA_V3).upgrade(async (tx) => {
            // Read v2 terms (which have subjectId and order)
            const oldTerms = await tx.table('terms').toArray();
            if (oldTerms.length === 0) return;

            // Build SubjectTerm rows from legacy term data
            const subjectTermsTable = tx.table('subjectTerms');
            const newTermsTable = tx.table('terms');

            const subjectTermLinks: Array<{ subjectId: string; termId: string; order: number }> = [];
            const cleanedTerms: Array<Record<string, unknown>> = [];

            for (const term of oldTerms) {
                if (term.subjectId) {
                    subjectTermLinks.push({
                        subjectId: term.subjectId,
                        termId: term.id,
                        order: term.order ?? 0,
                    });
                }
                const { subjectId: _subjectId, order: _order, ...cleanTerm } = term;
                cleanedTerms.push(cleanTerm);
            }

            await Promise.all([
                subjectTermsTable.bulkPut(subjectTermLinks),
                newTermsTable.bulkPut(cleanedTerms),
            ]);
        });
        this.version(4).stores(SCHEMA_V4);
        this.version(5).stores(SCHEMA_V5);
        this.version(6).stores(SCHEMA_V6);
        this.version(7).stores(SCHEMA_V7);
        // No upgrade callback here, deliberately: v8 changes `documentContents`' primary key
        // (`sourceId` → `documentId`), and IndexedDB cannot change a primary key in place — Dexie
        // throws "Not yet support for changing primary key" while diffing the schema, before any
        // `upgrade` callback runs. The callback that used to sit here (rewriting `sourceId` to
        // `documentId`) was therefore unreachable on every path: a fresh install never runs
        // old-version callbacks, and an existing v7 database fails to open before reaching it.
        // v14 is the first rekey in this chain that actually migrates rows, because it drops the
        // old store and declares a new one instead of changing the primary key in place
        // (see SCHEMA_V14 and __tests__/databaseV14Migration.test.ts).
        this.version(8).stores(SCHEMA_V8);
        this.version(9).stores(SCHEMA_V9);
        this.version(10).stores(SCHEMA_V10);
        this.version(11).stores(SCHEMA_V11);
        this.version(12).stores(SCHEMA_V12);
        this.version(13).stores(SCHEMA_V13);
        this.version(14).stores(SCHEMA_V14).upgrade(async (tx) => {
            // v13 held imported binaries in `importAssets`, keyed by `materialId` — at most
            // one blob per material, because the importer's single-file write path is what
            // populated it. IndexedDB cannot change a store's primary key in place (Dexie
            // throws "Not yet support for changing primary key"), so SCHEMA_V14 drops that
            // store and declares `localAssets`; this upgrade carries every row across before
            // the drop happens, in the same version.
            //
            // Each legacy row keeps its `materialId` as the new `assetId`. That value is
            // exactly what the legacy `lc-asset://{materialId}` document references point at,
            // so old markdown resolves with no rewrite. `materialId` is preserved from the
            // record rather than derived, so `assetId === materialId` holds for every migrated
            // row (asserted in __tests__/databaseV14Migration.test.ts).
            const legacyTable = tx.table('importAssets');
            const legacyRecords = (await legacyTable.toArray()) as Array<Omit<StoredAsset, 'assetId'>>;
            if (legacyRecords.length === 0) return;

            const migratedAssets: StoredAsset[] = legacyRecords.map((record) => ({
                assetId: record.materialId,
                materialId: record.materialId,
                blob: record.blob,
                mimeType: record.mimeType,
                filename: record.filename,
                importedAt: record.importedAt,
            }));

            await tx.table('localAssets').bulkPut(migratedAssets);
        });
    }
}

/** Singleton database instance shared across the application. */
export const db = new LunaClairDatabase();
