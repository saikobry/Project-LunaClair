import { describe, expect, it } from 'vitest';
import { reconcileTimestampLww, type LwwTimestampEntity } from '../TimestampLwwReconciler';

describe('TimestampLwwReconciler (Model A: Last-Write-Wins)', () => {
    const remoteRecord: LwwTimestampEntity = {
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-01T12:00:00.000Z',
    };

    it('applies remote entity when local record does not exist', () => {
        const result = reconcileTimestampLww(null, remoteRecord);
        expect(result.kind).toBe('apply');
        if (result.kind === 'apply') {
            expect(result.payload).toEqual(remoteRecord);
        }
    });

    it('applies remote entity when remote timestamp is newer than local', () => {
        const localOlder: LwwTimestampEntity = {
            createdAt: '2026-09-01T10:00:00.000Z',
            updatedAt: '2026-09-01T11:00:00.000Z',
        };

        const result = reconcileTimestampLww(localOlder, remoteRecord);
        expect(result.kind).toBe('apply');
    });

    it('ignores remote entity when local timestamp is newer than remote', () => {
        const localNewer: LwwTimestampEntity = {
            createdAt: '2026-09-01T10:00:00.000Z',
            updatedAt: '2026-09-01T13:00:00.000Z',
        };

        const result = reconcileTimestampLww(localNewer, remoteRecord);
        expect(result.kind).toBe('ignore');
        if (result.kind === 'ignore') {
            expect(result.reason).toBe('Local record is more recent');
        }
    });

    it('ignores remote entity on equal timestamps for deterministic idempotency', () => {
        const localSame: LwwTimestampEntity = {
            createdAt: '2026-09-01T10:00:00.000Z',
            updatedAt: '2026-09-01T12:00:00.000Z',
        };

        const result = reconcileTimestampLww(localSame, remoteRecord);
        expect(result.kind).toBe('ignore');
        if (result.kind === 'ignore') {
            expect(result.reason).toBe('Timestamps are identical');
        }
    });

    it('prioritizes deletedAt timestamp when handling deletion tombstones', () => {
        const localDeleted: LwwTimestampEntity = {
            createdAt: '2026-09-01T10:00:00.000Z',
            deletedAt: '2026-09-01T14:00:00.000Z',
        };

        const result = reconcileTimestampLww(localDeleted, remoteRecord);
        expect(result.kind).toBe('ignore');
    });
});
