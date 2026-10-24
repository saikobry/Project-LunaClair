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
  let mockSyncEngine: any;
  let mockAuth: any;
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

    mockSyncEngine = {
      pause: vi.fn(),
      resume: vi.fn().mockResolvedValue(undefined),
      isPaused: vi.fn().mockReturnValue(false),
    };

    mockAuth = {
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn().mockReturnValue({ user: { sub: 'test-user-sub' } }),
      getStatus: vi.fn().mockReturnValue('authenticated'),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getValidAccessToken: vi.fn().mockResolvedValue('token'),
    };

    mockContext = {
      useCases: {
        sync: {
          syncStatusStore: mockStore,
          syncEngine: mockSyncEngine,
          getConflictDrafts: mockGetConflictDrafts,
          triggerSync: mockTriggerSync,
        },
      },
      infrastructure: {
        providers: {
          auth: mockAuth,
          credentials: {
            getCredentials: vi.fn().mockResolvedValue({ userId: 'test-user-sub', deviceId: 'dev' }),
          },
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

  it('resolves to "standby" and suppresses pendingCount and lastError when unauthenticated', () => {
    mockAuth.getStatus.mockReturnValue('unauthenticated');
    mockStore.setState({
      state: 'error',
      pendingCount: 5,
      lastError: 'Worker unavailable',
    });

    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    expect(result.current.state).toBe('standby');
    expect(result.current.status).toBe('standby');
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.lastError).toBeUndefined();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('routes triggerSync to auth.login when unauthenticated', async () => {
    mockAuth.getStatus.mockReturnValue('unauthenticated');
    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    await act(async () => {
      await result.current.triggerSync();
    });

    expect(mockAuth.login).toHaveBeenCalledTimes(1);
    expect(mockTriggerSync.execute).not.toHaveBeenCalled();
  });

  it('suppresses pendingCount when store state is standby', () => {
    mockStore.setState({ state: 'standby', pendingCount: 4 });
    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    expect(result.current.state).toBe('standby');
    expect(result.current.pendingCount).toBe(0);
  });

  it('resolves to "paused" and retains pendingCount when state is paused', () => {
    mockSyncEngine.isPaused.mockReturnValue(true);
    mockStore.setState({ state: 'paused', pendingCount: 4 });
    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    expect(result.current.state).toBe('paused');
    expect(result.current.status).toBe('paused');
    expect(result.current.isPaused).toBe(true);
    expect(result.current.pendingCount).toBe(4);
  });

  it('reports isPaused false when syncEngine is not paused for active owner even if store state is paused', () => {
    mockSyncEngine.isPaused.mockReturnValue(false);
    mockStore.setState({ state: 'paused', pendingCount: 4 });
    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    expect(result.current.isPaused).toBe(false);
  });

  it('calls syncEngine.pause when pauseSync is invoked', async () => {
    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    await act(async () => {
      await result.current.pauseSync();
    });

    expect(mockSyncEngine.pause).toHaveBeenCalledWith('test-user-sub');
  });

  it('calls syncEngine.resume when resumeSync is invoked', async () => {
    const { result } = renderHook(() => useSyncStatus(), { wrapper });

    await act(async () => {
      await result.current.resumeSync();
    });

    expect(mockSyncEngine.resume).toHaveBeenCalledWith(
      { userId: 'test-user-sub', deviceId: 'dev' },
      'test-user-sub'
    );
  });
});
