import Dexie, { type Table } from 'dexie';
import type { StudyMaterial } from '../../domain/library/StudyMaterial';
import type { Question } from '../../domain/quiz/Question';
import type { Quiz } from '../../domain/quiz/Quiz';
import type { QuizSession } from '../../domain/quiz/QuizSession';
import type { Subject } from '../../domain/library/Subject';
import type { Term } from '../../domain/library/Term';
import type { SubjectTerm } from '../../domain/library/SubjectTerm';
import type { HighlightItem, DrawingPath } from '../../domain/reader';
import type { QuizDraft } from '../../application/quiz-management/drafts/QuizDraft';
import type { ReviewState } from '../../domain/flashcards/scheduler';
import type { ImportedDocumentContent } from '../../domain/reader';
import type { AiThread, AiMessageRecord } from '../../domain/ai/ai.types';
import { DB_NAME, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8, SCHEMA_V9 } from './schema';

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
 * Version 8: Rekeys documentContents from `sourceId` to `documentId`.
 * Version 9: Adds aiThreads and aiMessages for local-first AI chat persistence.
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
    subjects!: Table<Subject, string>;
    terms!: Table<Term, string>;
    subjectTerms!: Table<SubjectTerm, [string, string]>;
    quizEditingDrafts!: Table<QuizDraft, string>;
    flashcardReviews!: Table<ReviewState, string>;
    documentContents!: Table<ImportedDocumentContent, string>;
    aiThreads!: Table<AiThread, string>;
    aiMessages!: Table<AiMessageRecord, string>;

    constructor() {
        super(DB_NAME);
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
        this.version(8).stores(SCHEMA_V8).upgrade(async (tx) => {
            // v7 stored imported content keyed by `sourceId`; v8 rekeys to `documentId`.
            // Rewrite existing records so locally imported content survives the rename.
            const table = tx.table('documentContents');
            const records = (await table.toArray()) as Array<{
                sourceId?: string;
                title: string;
                content: string;
                updatedAt: string;
            }>;
            if (records.length > 0) {
                await table.clear();
                await table.bulkPut(
                    records.map((r) => ({
                        documentId: r.sourceId ?? '',
                        title: r.title,
                        content: r.content,
                        updatedAt: r.updatedAt,
                    })),
                );
            }
        });
        this.version(9).stores(SCHEMA_V9);
    }
}

/** Singleton database instance shared across the application. */
export const db = new LunaClairDatabase();
