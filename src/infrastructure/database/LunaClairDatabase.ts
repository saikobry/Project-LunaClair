import Dexie, { type Table } from 'dexie';
import type { StudyMaterial } from '../../domain/library/StudyMaterial';
import type { Question } from '../../domain/quiz/Question';
import type { Quiz } from '../../domain/quiz/Quiz';
import type { QuizSession } from '../../domain/quiz/QuizSession';
import type { Subject } from '../../domain/library/Subject';
import type { Term } from '../../domain/library/Term';
import type { SubjectTerm } from '../../domain/library/SubjectTerm';
import type { HighlightItem, DrawingPath } from '../../shared/types/annotation.types';
import { DB_NAME, SCHEMA_V1, SCHEMA_V2, SCHEMA_V3 } from './schema';

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
                const { subjectId, order, ...cleanTerm } = term;
                cleanedTerms.push(cleanTerm);
            }

            await Promise.all([
                subjectTermsTable.bulkPut(subjectTermLinks),
                newTermsTable.bulkPut(cleanedTerms),
            ]);
        });
    }
}

/** Singleton database instance shared across the application. */
export const db = new LunaClairDatabase();
