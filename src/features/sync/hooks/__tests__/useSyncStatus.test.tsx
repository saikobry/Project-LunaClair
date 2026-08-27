import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSyncStatus } from '../useSyncStatus';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { SyncStatusStore } from '../../../../application/sync/SyncStatusStore';

describe('useSyncStatus', () => {
  let mockStore: SyncStatusStore;
  let mockGetConflictDrafts: { execute: ReturnType<typeof vi.fn> };
  let mockTriggerSync: { execute: ReturnType<typeof vi.fn> };
  let mockContext: any;

  beforeEach(() => {
    mockStore = new SyncStatusStore({
      state: 'idle',
      pendingCount: 0,
      lastSyncedAt: '2026-08-27T10:00:00.000Z',
    });

    mockGetConflictDrafts = {
      execute: vi.fn().mockResolvedValue([]),
    };

    mockTriggerSync = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      useCases: {
        sync: {
          syncStatusStore: mockStore,
          getConflictDrafts: mockGetConflictDrafts,
          triggerSync: mockTriggerSync,
        },
      },
    };
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApplicationContext.Provider value={mockContext}>
      {children}
    </ApplicationContext.Provider>
  );

  it('returns initial state from store and fetches conflict count', async () => {
    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    expect(result.current.state).toBe('idle');
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.lastSyncedAt).toBe('2026-08-27T10:00:00.000Z');
    expect(result.current.lastError).toBeUndefined();

    await waitFor(() => {
      expect(mockGetConflictDrafts.execute).toHaveBeenCalled();
    });

    expect(result.current.conflictCount).toBe(0);
  });

  it('subscribes to store state updates', async () => {
    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    act(() => {
      mockStore.setState({
        state: 'syncing',
        pendingCount: 3,
      });
    });

    expect(result.current.state).toBe('syncing');
    expect(result.current.pendingCount).toBe(3);

    act(() => {
      mockStore.setState({
        state: 'error',
        lastError: 'Network timeout',
      });
    });

    expect(result.current.state).toBe('error');
    expect(result.current.lastError).toBe('Network timeout');
  });

  it('updates conflict count when conflict drafts are returned', async () => {
    mockGetConflictDrafts.execute.mockResolvedValue([
      {
        id: 'draft-1',
        documentId: 'doc-1',
        baseVersion: 1,
        serverVersion: 2,
        localContent: 'local',
        serverContent: 'server',
        createdAt: '2026-08-27T10:00:00.000Z',
      },
      {
        id: 'draft-2',
        documentId: 'doc-2',
        baseVersion: 2,
        serverVersion: 3,
        localContent: 'local 2',
        serverContent: 'server 2',
        createdAt: '2026-08-27T10:00:00.000Z',
      },
    ]);

    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    await waitFor(() => {
      expect(result.current.conflictCount).toBe(2);
    });
  });

  it('triggers sync cycle and refreshes conflict count', async () => {
    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    await act(async () => {
      await result.current.triggerSync();
    });

    expect(mockTriggerSync.execute).toHaveBeenCalledTimes(1);
    expect(mockGetConflictDrafts.execute).toHaveBeenCalled();
  });
});
