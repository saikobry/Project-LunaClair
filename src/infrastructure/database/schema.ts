/**
 * Dexie schema definition for LunaClair database.
 * Version 1: Phase 5 stores (materials, questions, quizzes, quizSessions, etc.)
 * Version 2: Phase 5.3 — adds subjects, terms tables; widens materials.
 * Version 3: Normalizes Subject↔Term relationship — adds subjectTerms junction,
 *            removes subjectId and order from terms (terms become global).
 * Version 4: Adds quizEditingDrafts — local crash-recovery store for the
 *            quiz canvas authoring session (autosaved QuizDraft DTOs).
 */
export const SCHEMA_V1 = {
    materials: 'id, sourceType, createdAt, lastOpenedAt',
    questions: 'id, materialId, type, difficulty, version, createdAt',
    quizzes: 'id, materialId, createdAt',
    quizSessions: 'id, quizId, mode, startedAt, completedAt',
    highlights: 'id, documentId, createdAt',
    drawings: 'id, documentId, createdAt',
    preferences: 'key',
    metadata: 'key',
} as const;

export const SCHEMA_V2 = {
    materials: 'id, subjectId, termId, sourceType, createdAt, lastOpenedAt',
    questions: 'id, materialId, type, difficulty, version, createdAt',
    quizzes: 'id, materialId, createdAt',
    quizSessions: 'id, quizId, mode, startedAt, completedAt',
    highlights: 'id, documentId, createdAt',
    drawings: 'id, documentId, createdAt',
    preferences: 'key',
    metadata: 'key',
    subjects: 'id, title, createdAt',
    terms: 'id, subjectId, order',
} as const;

export const SCHEMA_V3 = {
    materials: 'id, subjectId, termId, sourceType, createdAt, lastOpenedAt',
    questions: 'id, materialId, type, difficulty, version, createdAt',
    quizzes: 'id, materialId, createdAt',
    quizSessions: 'id, quizId, mode, startedAt, completedAt',
    highlights: 'id, documentId, createdAt',
    drawings: 'id, documentId, createdAt',
    preferences: 'key',
    metadata: 'key',
    subjects: 'id, title, createdAt',
    terms: 'id, title',
    subjectTerms: '[subjectId+termId], subjectId, termId',
} as const;

export const SCHEMA_V4 = {
    ...SCHEMA_V3,
    quizEditingDrafts: 'draftId, quizId, materialId, updatedAt',
} as const;

export const SCHEMA_V5 = {
    ...SCHEMA_V4,
    flashcardReviews: 'key, materialId, dueAt, lastReviewedAt',
} as const;

/**
 * Version 6: Adds documentContents — locally imported document markdown,
 * keyed by sourceId. The explicit local representation of an imported
 * material's content (the SW runtime cache is not the source of truth).
 */
export const SCHEMA_V6 = {
    ...SCHEMA_V5,
    documentContents: 'sourceId',
} as const;

export const DB_NAME = 'lunaclair-db';

