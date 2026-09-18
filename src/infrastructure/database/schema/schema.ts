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

/**
 * Version 7: Removes the legacy `sourceType` index from materials. The field
 * never drove behavior (the reader keys on `documentId`) and was stale storage
 * jargon from the pre-D1 bundled-content era — dropped end-to-end (domain,
 * Dexie, D1). Existing records keep the property, it is simply unindexed.
 */
export const SCHEMA_V7 = {
    ...SCHEMA_V6,
    materials: 'id, subjectId, termId, createdAt, lastOpenedAt',
} as const;

/**
 * Version 8: Rekeys `documentContents` from `sourceId` to `documentId` — the
 * vocabulary rename (the field is the document's key, not a generic "source").
 * The v8 upgrade rewrites existing records so locally imported content survives.
 */
export const SCHEMA_V8 = {
    ...SCHEMA_V7,
    documentContents: 'documentId',
} as const;

/**
 * Version 9: Adds aiThreads and aiMessages for local-first AI Study Assistant
 * conversation persistence. System prompts are never persisted.
 */
export const SCHEMA_V9 = {
    ...SCHEMA_V8,
    aiThreads: 'id, materialId, mode, createdAt, updatedAt',
    aiMessages: 'id, threadId, role, status, createdAt',
} as const;

export const SCHEMA_V10 = {
    ...SCHEMA_V9,
    importAssets: 'materialId',
} as const;

/**
 * Version 11: Adds syncQueue, syncState, and conflictDrafts for Phase 10
 * Cloud Synchronization (offline mutation queue, sync cursors, and conflict drafts).
 */
export const SCHEMA_V11 = {
    ...SCHEMA_V10,
    syncQueue: 'id, entityType, entityId, status, clientMutationId, createdAt',
    syncState: 'key, userId, deviceId, lastServerCursor, lastSyncedAt',
    conflictDrafts: 'id, documentId, baseVersion, serverVersion, createdAt',
} as const;

/**
 * Version 12: Adds the `originShareId` index on materials — exact clone
 * identity for Explore cloning (a material records the cloud share it was
 * cloned from, so library membership checks compare share IDs, not titles).
 */
export const SCHEMA_V12 = {
    ...SCHEMA_V11,
    materials: 'id, documentId, subjectId, termId, order, createdAt, updatedAt, lastOpenedAt, originShareId',
} as const;

export const DB_NAME = 'lunaclair-db';

/**
 * Version 13: Adds collections + collectionMaterials for the Collections
 * Playlist model (a material can belong to multiple collections via the
 * explicit `collectionMaterials` junction; each collection keeps its own
 * independent material ordering). Indexes `*tags` on materials.
 * Sunset: drops the obsolete `subjects`, `terms`, and `subjectTerms` tables
 * (null = delete) and removes `subjectId`/`termId` from the materials index.
 */
export const SCHEMA_V13 = {
    ...SCHEMA_V12,
    subjects: null,
    terms: null,
    subjectTerms: null,
    collections: 'id, title, order, createdAt',
    collectionMaterials: '++id, [collectionId+materialId], collectionId, materialId, order',
    materials: 'id, documentId, order, createdAt, updatedAt, lastOpenedAt, originShareId, *tags',
} as const;

/**
 * Version 14: Rekeys locally stored binary assets from `importAssets` (keyed by
 * `materialId` — at most one blob per material) to `localAssets` (keyed by `assetId`,
 * indexed by `materialId`), so N assets per material can coexist and an
 * `lc-asset://{assetId}` document reference resolves to its own blob.
 *
 * IndexedDB cannot change an object store's primary key in place — Dexie throws
 * "Not yet support for changing primary key" — so this version deletes the old store
 * (`null`) and declares the new one. The v14 upgrade copies every legacy row across,
 * preserving `materialId` as the new `assetId`, which is exactly what the legacy
 * `lc-asset://{materialId}` references point at: old markdown needs no rewrite.
 */
export const SCHEMA_V14 = {
    ...SCHEMA_V13,
    importAssets: null,
    localAssets: 'assetId, materialId',
} as const;
