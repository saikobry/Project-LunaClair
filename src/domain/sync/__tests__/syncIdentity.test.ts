import { describe, expect, it } from 'vitest';
import { createSyncStateKey, isValidSyncIdentity } from '../syncIdentity';

describe('syncIdentity', () => {
    describe('createSyncStateKey', () => {
        it('combines userId and deviceId into a composite key', () => {
            expect(createSyncStateKey('usr_123', 'dev_456')).toBe('usr_123:dev_456');
        });
    });

    describe('isValidSyncIdentity', () => {
        it('returns true for non-empty string userId and deviceId', () => {
            expect(isValidSyncIdentity('usr_1', 'dev_1')).toBe(true);
        });

        it('returns false when either identifier is empty or whitespace-only', () => {
            expect(isValidSyncIdentity('', 'dev_1')).toBe(false);
            expect(isValidSyncIdentity('usr_1', '   ')).toBe(false);
            expect(isValidSyncIdentity('   ', '')).toBe(false);
        });

        it('returns false when non-string types are supplied', () => {
            expect(isValidSyncIdentity(null as unknown as string, 'dev_1')).toBe(false);
            expect(isValidSyncIdentity('usr_1', undefined as unknown as string)).toBe(false);
        });
    });
});
