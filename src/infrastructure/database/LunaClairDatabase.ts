import Dexie, { type Table } from 'dexie';
import type { StudyMaterial } from '../../domain/library/StudyMaterial';
import type { Question } from '../../domain/quiz/Question';
import type { Quiz } from '../../domain/quiz/Quiz';
import type { QuizSession } from '../../domain/quiz/QuizSession';
import type { Subject } from '../../domain/library/Subject';
import type { Term } from '../../domain/library/Term';
import type { HighlightItem, DrawingPath } from '../../shared/types/annotation.types';
import { DB_NAME, SCHEMA_V1, SCHEMA_V2 } from './schema';

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

    constructor() {
        super(DB_NAME);
        this.version(1).stores(SCHEMA_V1);
        this.version(2).stores(SCHEMA_V2);
    }
}

/** Singleton database instance shared across the application. */
export const db = new LunaClairDatabase();
