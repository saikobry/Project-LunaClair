import { describe, it, expect } from 'vitest';
import {
  getSyncModelForEntity,
  createSyncStateKey,
  isValidSyncIdentity,
  SyncConflictError,
  OptimisticConcurrencyError,
  InvalidSyncPayloadError,
  InvalidSyncCursorError,
  OutboxTransactionError,
  type TypedSyncMutation,
  type DocumentSyncPayload,
  type HighlightSyncPayload,
  type DrawingSyncPayload,
  type FlashcardReviewSyncPayload,
  type QuizSessionSyncPayload,
  type ConflictDraft,
  type ReconcileResult,
} from '../index';

describe('Sync Domain Primitives & Models', () => {
  describe('getSyncModelForEntity', () => {
    it('maps document to versioned (Model C)', () => {
      expect(getSyncModelForEntity('document')).toBe('versioned');
    });

    it('maps highlight, drawing, and flashcardReview to lww (Model A)', () => {
      expect(getSyncModelForEntity('highlight')).toBe('lww');
      expect(getSyncModelForEntity('drawing')).toBe('lww');
      expect(getSyncModelForEntity('flashcardReview')).toBe('lww');
    });

    it('maps quizSession to append (Model B)', () => {
      expect(getSyncModelForEntity('quizSession')).toBe('append');
    });
  });

  describe('createSyncStateKey', () => {
    it('generates composite key formatted as userId:deviceId', () => {
      expect(createSyncStateKey('user-123', 'device-abc')).toBe('user-123:device-abc');
    });
  });

  describe('isValidSyncIdentity', () => {
    it('returns true for valid non-empty user and device IDs', () => {
      expect(isValidSyncIdentity('user-1', 'dev-1')).toBe(true);
    });

    it('returns false when userId or deviceId is empty or whitespace-only', () => {
      expect(isValidSyncIdentity('', 'dev-1')).toBe(false);
      expect(isValidSyncIdentity('user-1', '')).toBe(false);
      expect(isValidSyncIdentity('   ', 'dev-1')).toBe(false);
      expect(isValidSyncIdentity('user-1', '   ')).toBe(false);
    });

    it('returns false when inputs are not strings', () => {
      expect(isValidSyncIdentity(null as unknown as string, 'dev-1')).toBe(false);
      expect(isValidSyncIdentity('user-1', undefined as unknown as string)).toBe(false);
    });
  });

  describe('Sync Domain Errors', () => {
    it('instantiates SyncConflictError with properties and correct prototype', () => {
      const draft: ConflictDraft = {
        id: 'draft-1',
        documentId: 'doc-1',
        baseVersion: 1,
        serverVersion: 2,
        localContent: '# Local',
        serverContent: '# Server',
        createdAt: '2026-08-27T10:00:00.000Z',
      };
      const error = new SyncConflictError('Conflict on document edit', 'doc-1', 'document', draft);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SyncConflictError);
      expect(error.name).toBe('SyncConflictError');
      expect(error.message).toBe('Conflict on document edit');
      expect(error.entityId).toBe('doc-1');
      expect(error.entityType).toBe('document');
      expect(error.draft).toBe(draft);
    });

    it('instantiates OptimisticConcurrencyError with default or custom message', () => {
      const defaultErr = new OptimisticConcurrencyError('doc-1', 1, 3);
      expect(defaultErr).toBeInstanceOf(Error);
      expect(defaultErr.name).toBe('OptimisticConcurrencyError');
      expect(defaultErr.entityId).toBe('doc-1');
      expect(defaultErr.baseVersion).toBe(1);
      expect(defaultErr.serverVersion).toBe(3);
      expect(defaultErr.message).toContain('base version 1 does not match server version 3');

      const customErr = new OptimisticConcurrencyError('doc-1', 1, 3, 'Custom concurrency failure');
      expect(customErr.message).toBe('Custom concurrency failure');
    });

    it('instantiates InvalidSyncPayloadError with entityType and reason', () => {
      const err = new InvalidSyncPayloadError('Payload missing text', 'highlight', 'missing_field');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('InvalidSyncPayloadError');
      expect(err.entityType).toBe('highlight');
      expect(err.reason).toBe('missing_field');
    });

    it('instantiates InvalidSyncCursorError with cursor info', () => {
      const err = new InvalidSyncCursorError('Negative cursor', -5);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('InvalidSyncCursorError');
      expect(err.cursor).toBe(-5);
    });

    it('instantiates OutboxTransactionError with cause', () => {
      const cause = new Error('IndexedDB transaction failed');
      const err = new OutboxTransactionError('Outbox enqueue failed', cause);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('OutboxTransactionError');
      expect(err.cause).toBe(cause);
    });
  });

  describe('Typed Sync Mutation & Payloads', () => {
    it('constructs strongly-typed document mutation', () => {
      const documentPayload: DocumentSyncPayload = {
        documentId: 'doc-anatomy-1',
        title: 'Cardiac Anatomy',
        content: '# Cardiac Anatomy\nThe heart has four chambers.',
        updatedAt: '2026-08-27T10:00:00.000Z',
        version: 1,
      };

      const mutation: TypedSyncMutation<'document'> = {
        clientMutationId: 'mut-uuid-1',
        entityType: 'document',
        entityId: 'doc-anatomy-1',
        operation: 'UPSERT',
        baseVersion: 0,
        clientTimestamp: '2026-08-27T10:00:00.000Z',
        payload: documentPayload,
      };

      expect(mutation.entityType).toBe('document');
      expect(mutation.payload.documentId).toBe('doc-anatomy-1');
      expect(mutation.payload.version).toBe(1);
    });

    it('supports highlight payload with soft-deletion tombstone', () => {
      const highlightPayload: HighlightSyncPayload = {
        id: 'hl-1',
        documentId: 'doc-anatomy-1',
        start: 0,
        end: 16,
        color: 'yellow',
        text: 'Cardiac Anatomy',
        createdAt: '2026-08-27T10:00:00.000Z',
        deletedAt: '2026-08-27T10:05:00.000Z',
      };

      const mutation: TypedSyncMutation<'highlight'> = {
        clientMutationId: 'mut-uuid-2',
        entityType: 'highlight',
        entityId: 'hl-1',
        operation: 'DELETE',
        clientTimestamp: '2026-08-27T10:05:00.000Z',
        payload: highlightPayload,
      };

      expect(mutation.payload.deletedAt).toBe('2026-08-27T10:05:00.000Z');
    });

    it('supports drawing payload with points and soft-deletion tombstone', () => {
      const drawingPayload: DrawingSyncPayload = {
        id: 'draw-1',
        documentId: 'doc-anatomy-1',
        color: '#ff0000',
        thickness: 3,
        points: [
          { x: 0.1, y: 0.2 },
          { x: 0.15, y: 0.25 },
        ],
        isEraser: false,
        createdAt: '2026-08-27T10:00:00.000Z',
      };

      const mutation: TypedSyncMutation<'drawing'> = {
        clientMutationId: 'mut-uuid-3',
        entityType: 'drawing',
        entityId: 'draw-1',
        operation: 'UPSERT',
        clientTimestamp: '2026-08-27T10:00:00.000Z',
        payload: drawingPayload,
      };

      expect(mutation.payload.points).toHaveLength(2);
      expect(mutation.payload.deletedAt).toBeUndefined();
    });

    it('supports flashcard review payload', () => {
      const reviewPayload: FlashcardReviewSyncPayload = {
        key: 'fc-card-1',
        materialId: 'doc-anatomy-1',
        repetitions: 3,
        easeFactor: 2.6,
        intervalDays: 6,
        dueAt: '2026-09-02T10:00:00.000Z',
        lapses: 0,
        lastReviewedAt: '2026-08-27T10:00:00.000Z',
        reviewCount: 3,
      };

      const mutation: TypedSyncMutation<'flashcardReview'> = {
        clientMutationId: 'mut-uuid-4',
        entityType: 'flashcardReview',
        entityId: 'fc-card-1',
        operation: 'UPSERT',
        clientTimestamp: '2026-08-27T10:00:00.000Z',
        payload: reviewPayload,
      };

      expect(mutation.payload.repetitions).toBe(3);
      expect(mutation.payload.easeFactor).toBe(2.6);
    });

    it('supports quiz session payload', () => {
      const quizPayload: QuizSessionSyncPayload = {
        id: 'sess-1',
        quizId: 'quiz-anatomy-1',
        mode: 'standard',
        status: 'completed',
        questionSnapshots: {},
        answers: [],
        score: {
          correctAnswers: 5,
          incorrectAnswers: 0,
          earnedPoints: 5,
          maxPoints: 5,
          percentage: 100,
        },
        startedAt: '2026-08-27T09:00:00.000Z',
        completedAt: '2026-08-27T09:15:00.000Z',
      };

      const mutation: TypedSyncMutation<'quizSession'> = {
        clientMutationId: 'mut-uuid-5',
        entityType: 'quizSession',
        entityId: 'sess-1',
        operation: 'APPEND',
        clientTimestamp: '2026-08-27T09:15:00.000Z',
        payload: quizPayload,
      };

      expect(mutation.payload.score?.percentage).toBe(100);
    });

    it('handles all ReconcileResult discriminated variants', () => {
      const applied: ReconcileResult = { kind: 'applied', entityId: 'doc-1', version: 2 };
      const ignored: ReconcileResult = { kind: 'ignored', entityId: 'doc-1', reason: 'stale_timestamp' };
      const conflict: ReconcileResult = {
        kind: 'conflict',
        entityId: 'doc-1',
        draft: {
          id: 'cd-1',
          documentId: 'doc-1',
          baseVersion: 1,
          serverVersion: 2,
          localContent: 'L',
          serverContent: 'S',
          createdAt: '2026-08-27T10:00:00.000Z',
        },
      };
      const deleted: ReconcileResult = { kind: 'deleted', entityId: 'doc-1' };

      expect(applied.kind).toBe('applied');
      expect(ignored.kind).toBe('ignored');
      expect(conflict.kind).toBe('conflict');
      expect(deleted.kind).toBe('deleted');
    });
  });
});
