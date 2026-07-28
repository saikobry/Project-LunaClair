/**
 * Dexie schema definition for LunaClair database.
 * Version 1: Phase 5 stores (materials, questions, quizzes, quizSessions, etc.)
 * Version 2: Phase 5.3 — adds subjects, terms tables; widens materials.
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

export const DB_NAME = 'lunaclair-db';
export const DB_VERSION = 2;
