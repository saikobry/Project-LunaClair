import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import {
    DB_NAME,
    SCHEMA_V1,
    SCHEMA_V2,
    SCHEMA_V3,
    SCHEMA_V4,
    SCHEMA_V5,
    SCHEMA_V6,
    SCHEMA_V7,
    SCHEMA_V8,
    SCHEMA_V9,
    SCHEMA_V10,
    SCHEMA_V11,
} from '../schema';
import {
    LunaClairDatabase,
    type HighlightRecord,
    type DrawingRecord,
    type PreferenceRecord,
    type MetadataRecord,
    type ImportAssetRecord,
} from '../LunaClairDatabase';
import type { StudyMaterial } from '../../../domain/library/StudyMaterial';
import type { Question } from '../../../domain/quiz/Question';
import type { Quiz } from '../../../domain/quiz/Quiz';
import type { QuizSession } from '../../../domain/quiz/QuizSession';
import type { Subject } from '../../../domain/library/Subject';
import type { Term } from '../../../domain/library/Term';
import type { SubjectTerm } from '../../../domain/library/SubjectTerm';
import type { QuizDraft } from '../../../application/quiz-management/drafts/QuizDraft';
import type { ReviewState } from '../../../domain/flashcards/scheduler';
import type { ImportedDocumentContent } from '../../../domain/reader';
import type { AiThread, AiMessageRecord } from '../../../domain/ai/ai.types';
import type { SyncQueueItem, SyncState, ConflictDraft } from '../../../domain/sync/sync.types';

describe('Dexie Schema v11 & Non-Destructive Migration', () => {
    beforeEach(async () => {
        await Dexie.delete(DB_NAME);
    });

    afterEach(async () => {
        await Dexie.delete(DB_NAME);
    });

    it('successfully upgrades from v10 to v11 preserving all existing records across all v10 stores', async () => {
        // 1. Initialize a legacy v10 database using SCHEMA_V10 and full historical version chain
        class TestV10Database extends Dexie {
            constructor() {
                super(DB_NAME);
                this.version(1).stores(SCHEMA_V1);
                this.version(2).stores(SCHEMA_V2);
                this.version(3).stores(SCHEMA_V3);
                this.version(4).stores(SCHEMA_V4);
                this.version(5).stores(SCHEMA_V5);
                this.version(6).stores(SCHEMA_V6);
                this.version(7).stores(SCHEMA_V7);
                this.version(8).stores(SCHEMA_V8);
                this.version(9).stores(SCHEMA_V9);
                this.version(10).stores(SCHEMA_V10);
            }
        }

        const v10Db = new TestV10Database();
        await v10Db.open();
        expect(v10Db.verno).toBe(10);

        // 2. Seed representative test data across all v10 tables
        const testMaterial: StudyMaterial = {
            id: 'mat-cardio-1',
            title: 'Cardiovascular Physiology',
            description: 'Core concepts of cardiac mechanics',
            documentId: 'doc-cardio-1',
            subjectId: 'subj-med-1',
            termId: 'term-prelim-1',
            createdAt: '2026-08-01T08:00:00.000Z',
            updatedAt: '2026-08-01T08:00:00.000Z',
            lastOpenedAt: '2026-08-02T10:30:00.000Z',
        };

        const testQuestion: Question = {
            id: 'q-heart-1',
            materialId: 'mat-cardio-1',
            type: 'multiple_choice',
            prompt: 'Which chamber pumps oxygenated blood to the systemic circulation?',
            payload: {
                type: 'multiple_choice',
                choices: ['Right Atrium', 'Right Ventricle', 'Left Atrium', 'Left Ventricle'],
                correctIndex: 3,
            },
            difficulty: 'easy',
            points: 1,
            explanation: 'The left ventricle pumps oxygen-rich blood into the aorta.',
            tags: ['cardiology', 'anatomy'],
            status: 'published',
            version: 1,
            createdAt: '2026-08-01T08:30:00.000Z',
            updatedAt: '2026-08-01T08:30:00.000Z',
        };

        const testQuiz: Quiz = {
            id: 'quiz-cardio-1',
            materialId: 'mat-cardio-1',
            title: 'Cardiology Self-Assessment',
            description: 'Test your understanding of cardiac physiology',
            status: 'published',
            questionIds: ['q-heart-1'],
            items: [
                {
                    quizId: 'quiz-cardio-1',
                    questionId: 'q-heart-1',
                    questionVersion: 1,
                    order: 1,
                    points: 1,
                },
            ],
            createdAt: '2026-08-01T09:00:00.000Z',
            updatedAt: '2026-08-01T09:00:00.000Z',
        };

        const testQuizSession: QuizSession = {
            id: 'sess-cardio-1',
            quizId: 'quiz-cardio-1',
            mode: 'practice',
            status: 'completed',
            startedAt: '2026-08-02T11:00:00.000Z',
            completedAt: '2026-08-02T11:15:00.000Z',
            answers: [{ questionId: 'q-heart-1', value: 'Left Ventricle', isCorrect: true, earnedPoints: 1 }],
            score: {
                correctAnswers: 1,
                incorrectAnswers: 0,
                earnedPoints: 1,
                maxPoints: 1,
                percentage: 100,
            },
            questionSnapshots: {
                'q-heart-1': testQuestion,
            },
        };

        const testHighlight: HighlightRecord = {
            id: 'hl-cardio-1',
            documentId: 'doc-cardio-1',
            start: 120,
            end: 152,
            color: 'yellow',
            text: 'Left ventricular stroke volume',
            createdAt: '2026-08-01T08:15:00.000Z',
        };

        const testDrawing: DrawingRecord = {
            id: 'dr-cardio-1',
            documentId: 'doc-cardio-1',
            color: '#ff4444',
            thickness: 2,
            points: [
                { x: 0.1, y: 0.2 },
                { x: 0.15, y: 0.25 },
            ],
            createdAt: '2026-08-01T08:20:00.000Z',
        };

        const testSubject: Subject = {
            id: 'subj-med-1',
            title: 'Internal Medicine',
            description: 'Clinical disease pathophysiology',
            createdAt: '2026-08-01T07:00:00.000Z',
            updatedAt: '2026-08-01T07:00:00.000Z',
        };

        const testTerm: Term = {
            id: 'term-prelim-1',
            title: 'Prelim',
            createdAt: '2026-08-01T07:00:00.000Z',
            updatedAt: '2026-08-01T07:00:00.000Z',
        };

        const testSubjectTerm: SubjectTerm = {
            subjectId: 'subj-med-1',
            termId: 'term-prelim-1',
            order: 1,
        };

        const testQuizDraft: QuizDraft = {
            draftId: 'draft-cardio-1',
            quizId: 'quiz-cardio-1',
            materialId: 'mat-cardio-1',
            title: 'Cardio In-Progress Draft',
            description: 'Autosaved state during canvas edits',
            passingPercentage: 80,
            items: [],
            updatedAt: '2026-08-02T09:00:00.000Z',
            isDirty: false,
        };

        const testReviewState: ReviewState = {
            key: 'q-heart-1',
            materialId: 'mat-cardio-1',
            repetitions: 2,
            easeFactor: 2.5,
            intervalDays: 3,
            dueAt: '2026-08-10T08:00:00.000Z',
            lapses: 0,
            lastReviewedAt: '2026-08-07T08:00:00.000Z',
            reviewCount: 2,
        };

        const testDocContent: ImportedDocumentContent = {
            documentId: 'doc-cardio-1',
            title: 'Cardiovascular Physiology Notes',
            content: '# Cardiovascular System\n\nCardiac output is heart rate times stroke volume.',
            updatedAt: '2026-08-01T08:05:00.000Z',
        };

        const testAiThread: AiThread = {
            id: 'th-ai-1',
            materialId: 'doc-cardio-1',
            title: 'Cardiac Cycle Q&A',
            mode: 'assistant',
            createdAt: '2026-08-01T12:00:00.000Z',
            updatedAt: '2026-08-01T12:05:00.000Z',
        };

        const testAiMessage: AiMessageRecord = {
            id: 'msg-ai-1',
            threadId: 'th-ai-1',
            role: 'user',
            content: 'How does preload affect cardiac output?',
            status: 'complete',
            createdAt: '2026-08-01T12:00:30.000Z',
        };

        const testBlob = new Blob(['Sample binary content from imported PDF notes.'], { type: 'text/plain' });
        const testImportAsset: ImportAssetRecord = {
            materialId: 'mat-cardio-1',
            blob: testBlob,
            mimeType: 'text/plain',
            filename: 'cardio_lecture_notes.txt',
            importedAt: '2026-08-01T08:00:00.000Z',
        };

        const testPreference: PreferenceRecord = {
            key: 'reader.fontSize',
            value: 18,
        };

        const testMetadata: MetadataRecord = {
            key: 'databaseVersion',
            value: 10,
        };

        await v10Db.table('materials').put(testMaterial);
        await v10Db.table('questions').put(testQuestion);
        await v10Db.table('quizzes').put(testQuiz);
        await v10Db.table('quizSessions').put(testQuizSession);
        await v10Db.table('highlights').put(testHighlight);
        await v10Db.table('drawings').put(testDrawing);
        await v10Db.table('subjects').put(testSubject);
        await v10Db.table('terms').put(testTerm);
        await v10Db.table('subjectTerms').put(testSubjectTerm);
        await v10Db.table('quizEditingDrafts').put(testQuizDraft);
        await v10Db.table('flashcardReviews').put(testReviewState);
        await v10Db.table('documentContents').put(testDocContent);
        await v10Db.table('aiThreads').put(testAiThread);
        await v10Db.table('aiMessages').put(testAiMessage);
        await v10Db.table('importAssets').put(testImportAsset);
        await v10Db.table('preferences').put(testPreference);
        await v10Db.table('metadata').put(testMetadata);

        // Close v10 database
        v10Db.close();

        // 3. Open database with LunaClairDatabase (v11)
        const v11Db = new LunaClairDatabase();
        await v11Db.open();

        expect(v11Db.verno).toBe(11);

        // 4. Verify all seeded v10 records are preserved untouched
        const preservedMaterial = await v11Db.materials.get('mat-cardio-1');
        expect(preservedMaterial).toEqual(testMaterial);

        const preservedQuestion = await v11Db.questions.get('q-heart-1');
        expect(preservedQuestion).toEqual(testQuestion);

        const preservedQuiz = await v11Db.quizzes.get('quiz-cardio-1');
        expect(preservedQuiz).toEqual(testQuiz);

        const preservedSession = await v11Db.quizSessions.get('sess-cardio-1');
        expect(preservedSession).toEqual(testQuizSession);

        const preservedHighlight = await v11Db.highlights.get('hl-cardio-1');
        expect(preservedHighlight).toEqual(testHighlight);

        const preservedDrawing = await v11Db.drawings.get('dr-cardio-1');
        expect(preservedDrawing).toEqual(testDrawing);

        const preservedSubject = await v11Db.subjects.get('subj-med-1');
        expect(preservedSubject).toEqual(testSubject);

        const preservedTerm = await v11Db.terms.get('term-prelim-1');
        expect(preservedTerm).toEqual(testTerm);

        const preservedSubjectTerm = await v11Db.subjectTerms.get(['subj-med-1', 'term-prelim-1']);
        expect(preservedSubjectTerm).toEqual(testSubjectTerm);

        const preservedQuizDraft = await v11Db.quizEditingDrafts.get('draft-cardio-1');
        expect(preservedQuizDraft).toEqual(testQuizDraft);

        const preservedReviewState = await v11Db.flashcardReviews.get('q-heart-1');
        expect(preservedReviewState).toEqual(testReviewState);

        const preservedDocContent = await v11Db.documentContents.get('doc-cardio-1');
        expect(preservedDocContent).toEqual(testDocContent);

        const preservedAiThread = await v11Db.aiThreads.get('th-ai-1');
        expect(preservedAiThread).toEqual(testAiThread);

        const preservedAiMessage = await v11Db.aiMessages.get('msg-ai-1');
        expect(preservedAiMessage).toEqual(testAiMessage);

        const preservedImportAsset = await v11Db.importAssets.get('mat-cardio-1');
        expect(preservedImportAsset).toBeDefined();
        expect(preservedImportAsset?.materialId).toBe(testImportAsset.materialId);
        expect(preservedImportAsset?.filename).toBe(testImportAsset.filename);
        expect(preservedImportAsset?.mimeType).toBe(testImportAsset.mimeType);
        expect(preservedImportAsset?.importedAt).toBe(testImportAsset.importedAt);
        expect(preservedImportAsset?.blob).toBeDefined();
        expect(preservedImportAsset?.blob).not.toBeNull();

        const preservedPreference = await v11Db.preferences.get('reader.fontSize');
        expect(preservedPreference).toEqual(testPreference);

        const preservedMetadata = await v11Db.metadata.get('databaseVersion');
        expect(preservedMetadata).toEqual(testMetadata);

        v11Db.close();
    });

    it('exposes typed syncQueue table with correct indices and supports CRUD operations', async () => {
        const db = new LunaClairDatabase();
        await db.open();

        expect(db.syncQueue).toBeDefined();

        const item1: SyncQueueItem = {
            id: 'sync-q-1',
            clientMutationId: 'mut-uuid-1',
            entityType: 'document',
            entityId: 'doc-101',
            operation: 'UPSERT',
            clientTimestamp: '2026-08-27T10:00:00.000Z',
            payload: { title: 'New Material' },
            status: 'pending',
            retryCount: 0,
            createdAt: '2026-08-27T10:00:00.000Z',
        };

        const item2: SyncQueueItem = {
            id: 'sync-q-2',
            clientMutationId: 'mut-uuid-2',
            entityType: 'document',
            entityId: 'doc-101',
            operation: 'UPSERT',
            clientTimestamp: '2026-08-27T10:05:00.000Z',
            payload: { content: 'Updated Markdown' },
            status: 'failed',
            retryCount: 3,
            lastError: 'Network timeout',
            createdAt: '2026-08-27T10:05:00.000Z',
        };

        // CREATE
        await db.syncQueue.bulkAdd([item1, item2]);

        // READ by Primary Key
        const fetched1 = await db.syncQueue.get('sync-q-1');
        expect(fetched1).toEqual(item1);

        // READ via indexed queries
        const pendingItems = await db.syncQueue.where('status').equals('pending').toArray();
        expect(pendingItems).toHaveLength(1);
        expect(pendingItems[0].id).toBe('sync-q-1');

        const documentItems = await db.syncQueue.where('entityType').equals('document').toArray();
        expect(documentItems).toHaveLength(2);

        const entityLookups = await db.syncQueue.where('entityId').equals('doc-101').toArray();
        expect(entityLookups).toHaveLength(2);

        const mutationLookups = await db.syncQueue.where('clientMutationId').equals('mut-uuid-2').toArray();
        expect(mutationLookups).toHaveLength(1);
        expect(mutationLookups[0].id).toBe('sync-q-2');

        const createdLookups = await db.syncQueue.where('createdAt').equals('2026-08-27T10:00:00.000Z').toArray();
        expect(createdLookups).toHaveLength(1);
        expect(createdLookups[0].id).toBe('sync-q-1');

        // UPDATE
        await db.syncQueue.update('sync-q-1', {
            status: 'failed',
            lastError: 'Temporary network failure',
        });
        const updated1 = await db.syncQueue.get('sync-q-1');
        expect(updated1?.status).toBe('failed');
        expect(updated1?.lastError).toBe('Temporary network failure');

        // DELETE
        await db.syncQueue.delete('sync-q-2');
        const afterDelete = await db.syncQueue.toArray();
        expect(afterDelete).toHaveLength(1);
        expect(afterDelete[0].id).toBe('sync-q-1');

        db.close();
    });

    it('exposes typed syncState table with correct indices and supports CRUD operations', async () => {
        const db = new LunaClairDatabase();
        await db.open();

        expect(db.syncState).toBeDefined();

        const stateRecord: SyncState = {
            key: 'usr-alice-1:dev-chrome-windows-1',
            userId: 'usr-alice-1',
            deviceId: 'dev-chrome-windows-1',
            lastServerCursor: 5432,
            lastSyncedAt: '2026-08-27T09:00:00.000Z',
        };

        // CREATE
        await db.syncState.put(stateRecord);

        // READ by Primary Key
        const fetched = await db.syncState.get('usr-alice-1:dev-chrome-windows-1');
        expect(fetched).toEqual(stateRecord);

        // READ via indexed queries
        const userState = await db.syncState.where('userId').equals('usr-alice-1').first();
        expect(userState?.key).toBe('usr-alice-1:dev-chrome-windows-1');

        const deviceState = await db.syncState.where('deviceId').equals('dev-chrome-windows-1').first();
        expect(deviceState?.key).toBe('usr-alice-1:dev-chrome-windows-1');

        const cursorState = await db.syncState.where('lastServerCursor').equals(5432).first();
        expect(cursorState?.key).toBe('usr-alice-1:dev-chrome-windows-1');

        const syncedAtState = await db.syncState.where('lastSyncedAt').equals('2026-08-27T09:00:00.000Z').first();
        expect(syncedAtState?.key).toBe('usr-alice-1:dev-chrome-windows-1');

        // UPDATE
        await db.syncState.update('usr-alice-1:dev-chrome-windows-1', {
            lastServerCursor: 5433,
            lastSyncedAt: '2026-08-27T09:30:00.000Z',
        });
        const updated = await db.syncState.get('usr-alice-1:dev-chrome-windows-1');
        expect(updated?.lastServerCursor).toBe(5433);
        expect(updated?.lastSyncedAt).toBe('2026-08-27T09:30:00.000Z');

        // DELETE
        await db.syncState.delete('usr-alice-1:dev-chrome-windows-1');
        const fetchedAfterDelete = await db.syncState.get('usr-alice-1:dev-chrome-windows-1');
        expect(fetchedAfterDelete).toBeUndefined();

        db.close();
    });

    it('exposes typed conflictDrafts table with correct indices and supports CRUD operations', async () => {
        const db = new LunaClairDatabase();
        await db.open();

        expect(db.conflictDrafts).toBeDefined();

        const draft1: ConflictDraft = {
            id: 'conflict-d-1',
            documentId: 'doc-cardio-1',
            baseVersion: 2,
            serverVersion: 3,
            localContent: '# Local modifications to cardio notes',
            serverContent: '# Remote modifications from another device',
            createdAt: '2026-08-27T08:00:00.000Z',
        };

        // CREATE
        await db.conflictDrafts.add(draft1);

        // READ by Primary Key
        const fetched = await db.conflictDrafts.get('conflict-d-1');
        expect(fetched).toEqual(draft1);

        // READ via indexed queries
        const docConflicts = await db.conflictDrafts.where('documentId').equals('doc-cardio-1').toArray();
        expect(docConflicts).toHaveLength(1);
        expect(docConflicts[0].id).toBe('conflict-d-1');

        const baseVerConflicts = await db.conflictDrafts.where('baseVersion').equals(2).toArray();
        expect(baseVerConflicts).toHaveLength(1);
        expect(baseVerConflicts[0].id).toBe('conflict-d-1');

        const serverVerConflicts = await db.conflictDrafts.where('serverVersion').equals(3).toArray();
        expect(serverVerConflicts).toHaveLength(1);
        expect(serverVerConflicts[0].id).toBe('conflict-d-1');

        const createdConflicts = await db.conflictDrafts.where('createdAt').equals('2026-08-27T08:00:00.000Z').toArray();
        expect(createdConflicts).toHaveLength(1);
        expect(createdConflicts[0].id).toBe('conflict-d-1');

        // UPDATE (Modify server version/content)
        await db.conflictDrafts.update('conflict-d-1', {
            serverVersion: 4,
            serverContent: '# Updated remote modifications from server',
        });
        const updated = await db.conflictDrafts.get('conflict-d-1');
        expect(updated?.serverVersion).toBe(4);
        expect(updated?.serverContent).toBe('# Updated remote modifications from server');

        // DELETE
        await db.conflictDrafts.delete('conflict-d-1');
        const fetchedAfterDelete = await db.conflictDrafts.get('conflict-d-1');
        expect(fetchedAfterDelete).toBeUndefined();

        db.close();
    });

    it('matches exact table schema definition in SCHEMA_V11', () => {
        expect(SCHEMA_V11.syncQueue).toBe('id, entityType, entityId, status, clientMutationId, createdAt');
        expect(SCHEMA_V11.syncState).toBe('key, userId, deviceId, lastServerCursor, lastSyncedAt');
        expect(SCHEMA_V11.conflictDrafts).toBe('id, documentId, baseVersion, serverVersion, createdAt');
    });
});
