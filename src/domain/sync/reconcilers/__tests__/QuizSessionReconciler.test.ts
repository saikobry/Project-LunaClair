import { describe, expect, it } from 'vitest';
import { reconcileQuizSession } from '../QuizSessionReconciler';
import type { QuizSessionSyncPayload } from '../../models/SyncEntities';

describe('QuizSessionReconciler (Model B: Append-Only Immutable History)', () => {
    const remoteSession: QuizSessionSyncPayload = {
        id: 'session-123',
        quizId: 'quiz-abc',
        mode: 'practice',
        status: 'completed',
        score: {
            correctAnswers: 10,
            incorrectAnswers: 0,
            earnedPoints: 50,
            maxPoints: 50,
            percentage: 100,
        },
        answers: [],
        questionSnapshots: {},
        startedAt: '2026-09-01T10:00:00.000Z',
        completedAt: '2026-09-01T10:15:00.000Z',
    };

    it('applies remote session when session does not exist locally', () => {
        const result = reconcileQuizSession(null, remoteSession);
        expect(result.kind).toBe('apply');
        if (result.kind === 'apply') {
            expect(result.payload).toEqual(remoteSession);
        }
    });

    it('ignores remote session when session already exists locally (immutable append-only record)', () => {
        const result = reconcileQuizSession({ id: 'session-123' }, remoteSession);
        expect(result.kind).toBe('ignore');
        if (result.kind === 'ignore') {
            expect(result.reason).toContain('immutable append-only record');
        }
    });

    it('demonstrates idempotent behavior on repeated reconciliation passes', () => {
        // First sync pass: inserts new session
        const pass1 = reconcileQuizSession(undefined, remoteSession);
        expect(pass1.kind).toBe('apply');

        // Second sync pass with now existing session: safely ignored
        const pass2 = reconcileQuizSession(remoteSession, remoteSession);
        expect(pass2.kind).toBe('ignore');

        // Third sync pass: still ignored identically
        const pass3 = reconcileQuizSession(remoteSession, remoteSession);
        expect(pass3.kind).toBe('ignore');
    });
});
