import { describe, it, expect } from 'vitest';
import {
  reconcileDocument,
  reconcileTimestampLww,
  reconcileFlashcardReview,
  reconcileQuizSession,
  type LocalDocumentState,
} from '../index';
import type {
  DocumentSyncPayload,
  HighlightSyncPayload,
  DrawingSyncPayload,
  FlashcardReviewSyncPayload,
  QuizSessionSyncPayload,
  SyncQueueItem,
} from '../../index';

describe('Domain Sync Reconcilers', () => {
  describe('DocumentReconciler (Model C - Optimistic Concurrency & Divergence)', () => {
    const remoteDoc: DocumentSyncPayload = {
      documentId: 'doc-bio-1',
      title: 'Cellular Biology',
      content: '# Canonical Remote Biology Content\nVersion 2 details.',
      updatedAt: '2026-08-27T12:00:00.000Z',
      version: 2,
    };

    it('applies remote document when local state is clean (no unpushed mutation)', () => {
      const localDoc: LocalDocumentState = {
        documentId: 'doc-bio-1',
        title: 'Cellular Biology',
        content: '# Old Local Content',
        updatedAt: '2026-08-27T10:00:00.000Z',
        version: 1,
      };

      const result = reconcileDocument(localDoc, remoteDoc, null);

      expect(result.kind).toBe('apply');
      if (result.kind === 'apply') {
        expect(result.document).toEqual(remoteDoc);
      }
    });

    it('applies remote document when local doc is null/undefined and no unpushed mutation', () => {
      const result = reconcileDocument(null, remoteDoc, undefined);

      expect(result.kind).toBe('apply');
      if (result.kind === 'apply') {
        expect(result.document).toEqual(remoteDoc);
      }
    });

    it('applies remote document when unpushed mutation has identical content to remote', () => {
      const localDoc: LocalDocumentState = {
        documentId: 'doc-bio-1',
        content: remoteDoc.content,
      };

      const unpushed: SyncQueueItem<Partial<DocumentSyncPayload>> = {
        id: 'q-item-1',
        clientMutationId: 'mut-1',
        entityType: 'document',
        entityId: 'doc-bio-1',
        operation: 'UPSERT',
        baseVersion: 1,
        clientTimestamp: '2026-08-27T11:59:00.000Z',
        payload: { content: remoteDoc.content },
        status: 'pending',
        createdAt: '2026-08-27T11:59:00.000Z',
        retryCount: 0,
      };

      const result = reconcileDocument(localDoc, remoteDoc, unpushed);

      expect(result.kind).toBe('apply');
    });

    it('returns compatible when unpushed mutation has matching baseVersion', () => {
      const localDoc: LocalDocumentState = {
        documentId: 'doc-bio-1',
        content: '# Unpushed Local Edits based on v2',
        version: 2,
      };

      const unpushed: SyncQueueItem<Partial<DocumentSyncPayload>> = {
        id: 'q-item-2',
        clientMutationId: 'mut-2',
        entityType: 'document',
        entityId: 'doc-bio-1',
        operation: 'UPSERT',
        baseVersion: 2, // Matches remoteDoc.version
        clientTimestamp: '2026-08-27T12:05:00.000Z',
        payload: { content: localDoc.content },
        status: 'pending',
        createdAt: '2026-08-27T12:05:00.000Z',
        retryCount: 0,
      };

      const result = reconcileDocument(localDoc, remoteDoc, unpushed);

      expect(result.kind).toBe('compatible');
    });

    it('returns conflict with branched ConflictDraft when unpushed mutation baseVersion diverges', () => {
      const localDoc: LocalDocumentState = {
        documentId: 'doc-bio-1',
        title: 'Cellular Biology Local',
        content: '# Stale Local Edits (Branch Alpha)',
        version: 1,
      };

      const unpushed: SyncQueueItem<Partial<DocumentSyncPayload>> = {
        id: 'q-item-3',
        clientMutationId: 'mut-3',
        entityType: 'document',
        entityId: 'doc-bio-1',
        operation: 'UPSERT',
        baseVersion: 1, // Diverges from remoteDoc.version = 2
        clientTimestamp: '2026-08-27T12:05:00.000Z',
        payload: { content: localDoc.content },
        status: 'pending',
        createdAt: '2026-08-27T12:05:00.000Z',
        retryCount: 0,
      };

      const result = reconcileDocument(localDoc, remoteDoc, unpushed);

      expect(result.kind).toBe('conflict');
      if (result.kind === 'conflict') {
        expect(result.draft).toMatchObject({
          documentId: 'doc-bio-1',
          baseVersion: 1,
          serverVersion: 2,
          localContent: '# Stale Local Edits (Branch Alpha)',
          serverContent: remoteDoc.content,
        });
        expect(result.draft.id).toBeDefined();
        expect(result.draft.createdAt).toBeDefined();
        expect(result.canonicalServerDoc).toEqual(remoteDoc);
      }
    });
  });

  describe('TimestampLwwReconciler (Model A - LWW Highlights & Drawings)', () => {
    describe('Highlights', () => {
      const baseHighlight: HighlightSyncPayload = {
        id: 'hl-1',
        documentId: 'doc-1',
        start: 10,
        end: 20,
        color: 'yellow',
        text: 'original text',
        createdAt: '2026-08-27T10:00:00.000Z',
      };

      it('applies remote highlight when local does not exist', () => {
        const result = reconcileTimestampLww(null, baseHighlight);
        expect(result.kind).toBe('apply');
        if (result.kind === 'apply') {
          expect(result.payload).toEqual(baseHighlight);
        }
      });

      it('applies remote highlight when remote is newer than local', () => {
        const local = {
          ...baseHighlight,
          text: 'local older text',
          createdAt: '2026-08-27T10:00:00.000Z',
        };
        const remote = {
          ...baseHighlight,
          text: 'remote newer text',
          createdAt: '2026-08-27T11:00:00.000Z',
        };

        const result = reconcileTimestampLww(local, remote);
        expect(result.kind).toBe('apply');
        if (result.kind === 'apply') {
          expect(result.payload.text).toBe('remote newer text');
        }
      });

      it('ignores remote highlight when local is newer than remote', () => {
        const local = {
          ...baseHighlight,
          text: 'local newer text',
          createdAt: '2026-08-27T12:00:00.000Z',
        };
        const remote = {
          ...baseHighlight,
          text: 'remote older text',
          createdAt: '2026-08-27T11:00:00.000Z',
        };

        const result = reconcileTimestampLww(local, remote);
        expect(result.kind).toBe('ignore');
      });

      it('ignores remote highlight when timestamps are equal', () => {
        const ts = '2026-08-27T10:00:00.000Z';
        const local = { ...baseHighlight, createdAt: ts };
        const remote = { ...baseHighlight, createdAt: ts };

        const result = reconcileTimestampLww(local, remote);
        expect(result.kind).toBe('ignore');
      });

      it('applies remote tombstone when remote deletedAt is newer than local createdAt', () => {
        const local = {
          ...baseHighlight,
          createdAt: '2026-08-27T10:00:00.000Z',
        };
        const remoteTombstone = {
          ...baseHighlight,
          createdAt: '2026-08-27T10:00:00.000Z',
          deletedAt: '2026-08-27T11:00:00.000Z',
        };

        const result = reconcileTimestampLww(local, remoteTombstone);
        expect(result.kind).toBe('apply');
        if (result.kind === 'apply') {
          expect(result.payload.deletedAt).toBe('2026-08-27T11:00:00.000Z');
        }
      });
    });

    describe('Drawings', () => {
      const baseDrawing: DrawingSyncPayload = {
        id: 'draw-1',
        documentId: 'doc-1',
        color: '#ff0000',
        thickness: 2,
        points: [{ x: 0.1, y: 0.2 }],
        createdAt: '2026-08-27T10:00:00.000Z',
      };

      it('applies newer remote drawing paths', () => {
        const local = { ...baseDrawing, createdAt: '2026-08-27T09:00:00.000Z' };
        const remote = { ...baseDrawing, createdAt: '2026-08-27T10:00:00.000Z', thickness: 4 };

        const result = reconcileTimestampLww(local, remote);
        expect(result.kind).toBe('apply');
        if (result.kind === 'apply') {
          expect(result.payload.thickness).toBe(4);
        }
      });
    });
  });

  describe('FlashcardReviewReconciler (Model A - Spaced Repetition)', () => {
    const baseReview: FlashcardReviewSyncPayload = {
      key: 'card-bio-1',
      repetitions: 2,
      easeFactor: 2.5,
      intervalDays: 6,
      dueAt: '2026-09-02T12:00:00.000Z',
      lapses: 0,
      reviewCount: 2,
    };

    it('applies remote review when local state does not exist', () => {
      const result = reconcileFlashcardReview(null, baseReview);
      expect(result.kind).toBe('apply');
      if (result.kind === 'apply') {
        expect(result.payload).toEqual(baseReview);
      }
    });

    it('applies remote when remote has a more recent lastReviewedAt', () => {
      const local = {
        ...baseReview,
        lastReviewedAt: '2026-08-27T08:00:00.000Z',
        repetitions: 1,
      };
      const remote = {
        ...baseReview,
        lastReviewedAt: '2026-08-27T12:00:00.000Z',
        repetitions: 2,
      };

      const result = reconcileFlashcardReview(local, remote);
      expect(result.kind).toBe('apply');
      if (result.kind === 'apply') {
        expect(result.payload.lastReviewedAt).toBe('2026-08-27T12:00:00.000Z');
      }
    });

    it('ignores remote when local has a more recent lastReviewedAt', () => {
      const local = {
        ...baseReview,
        lastReviewedAt: '2026-08-27T14:00:00.000Z',
        repetitions: 3,
      };
      const remote = {
        ...baseReview,
        lastReviewedAt: '2026-08-27T12:00:00.000Z',
        repetitions: 2,
      };

      const result = reconcileFlashcardReview(local, remote);
      expect(result.kind).toBe('ignore');
    });

    it('prefers reviewed remote state over unreviewed local state', () => {
      const localUnreviewed = {
        ...baseReview,
        lastReviewedAt: undefined,
        repetitions: 0,
      };
      const remoteReviewed = {
        ...baseReview,
        lastReviewedAt: '2026-08-27T10:00:00.000Z',
        repetitions: 1,
      };

      const result = reconcileFlashcardReview(localUnreviewed, remoteReviewed);
      expect(result.kind).toBe('apply');
    });

    it('ignores remote when all flashcard comparison criteria are identical', () => {
      const review: FlashcardReviewSyncPayload = {
        ...baseReview,
        lastReviewedAt: '2026-08-27T10:00:00.000Z',
      };

      const result = reconcileFlashcardReview(review, review);
      expect(result.kind).toBe('ignore');
    });
  });

  describe('QuizSessionReconciler (Model B - Append-Only Immutable Records)', () => {
    const remoteSession: QuizSessionSyncPayload = {
      id: 'session-quiz-101',
      quizId: 'quiz-pathology',
      mode: 'practice',
      status: 'completed',
      questionSnapshots: {},
      answers: [],
      score: {
        correctAnswers: 10,
        incorrectAnswers: 0,
        earnedPoints: 100,
        maxPoints: 100,
        percentage: 100,
      },
      startedAt: '2026-08-27T10:00:00.000Z',
      completedAt: '2026-08-27T10:15:00.000Z',
    };

    it('applies remote quiz session when local record does not exist', () => {
      const result = reconcileQuizSession(null, remoteSession);
      expect(result.kind).toBe('apply');
      if (result.kind === 'apply') {
        expect(result.payload).toEqual(remoteSession);
      }
    });

    it('ignores remote quiz session when local session already exists (immutable history)', () => {
      const localSession = {
        id: 'session-quiz-101',
      };

      const result = reconcileQuizSession(localSession, remoteSession);
      expect(result.kind).toBe('ignore');
    });
  });
});
