/**
 * Dexie schema definition for LunaClair database version 1.
 * Contains only the 8 object stores required by Phase 5.
 * Future stores (flashcards, reviews, searchIndex) will be added
 * via version(2), version(3), etc. when those phases are built.
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

export const DB_NAME = 'lunaclair-db';
export const DB_VERSION = 1;
