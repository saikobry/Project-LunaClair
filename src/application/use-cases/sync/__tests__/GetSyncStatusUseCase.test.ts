import { describe, it, expect } from 'vitest';
import { GetSyncStatusUseCase } from '../GetSyncStatusUseCase';
import { SyncStatusStore } from '../../../sync/SyncStatusStore';

describe('GetSyncStatusUseCase', () => {
    it('returns current state from statusStore', () => {
        const statusStore = new SyncStatusStore();
        statusStore.setState({
            state: 'syncing',
            pendingCount: 5,
            lastServerCursor: 42,
        });

        const useCase = new GetSyncStatusUseCase(statusStore);
        const status = useCase.execute();

        expect(status.state).toBe('syncing');
        expect(status.pendingCount).toBe(5);
        expect(status.lastServerCursor).toBe(42);
    });
});
