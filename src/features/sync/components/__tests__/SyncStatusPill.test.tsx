import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SyncStatusPill } from '../SyncStatusPill';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { SyncStatusStore } from '../../../../application/sync/SyncStatusStore';

describe('SyncStatusPill', () => {
  let mockStore: SyncStatusStore;
  let mockGetConflictDrafts: { execute: ReturnType<typeof vi.fn> };
  let mockTriggerSync: { execute: ReturnType<typeof vi.fn> };
  let mockResolveConflictDraft: { execute: ReturnType<typeof vi.fn> };
  let mockSyncEngine: any;
  let mockAuth: any;
  let mockContext: any;

  beforeEach(() => {
    mockStore = new SyncStatusStore({
      state: 'idle',
      pendingCount: 0,
      lastSyncedAt: new Date().toISOString(),
    });

    mockGetConflictDrafts = {
      execute: vi.fn().mockResolvedValue([]),
    };

    mockTriggerSync = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockResolveConflictDraft = {
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
          resolveConflictDraft: mockResolveConflictDraft,
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

  function renderComponent(ui = <SyncStatusPill />) {
    return render(
      <ApplicationContext.Provider value={mockContext}>
        {ui}
      </ApplicationContext.Provider>
    );
  }

  it('renders "Synced" state with check icon when idle', () => {
    renderComponent();
    expect(screen.getByText('Synced')).toBeInTheDocument();
  });

  it('renders "Syncing..." state when syncing', () => {
    mockStore.setState({ state: 'syncing' });
    renderComponent();
    expect(screen.getByText('Syncing...')).toBeInTheDocument();
  });

  it('renders "Offline" state when disconnected', () => {
    mockStore.setState({ state: 'offline' });
    renderComponent();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders "Sync error" state on error', () => {
    mockStore.setState({ state: 'error', lastError: 'Worker unavailable' });
    renderComponent();
    expect(screen.getByText('Sync error')).toBeInTheDocument();
  });

  it('renders conflict badge when conflicts exist', async () => {
    mockGetConflictDrafts.execute.mockResolvedValue([
      {
        id: 'draft-1',
        documentId: 'doc-1',
        baseVersion: 1,
        serverVersion: 2,
        localContent: 'local content',
        serverContent: 'server content',
        createdAt: '2026-08-27T10:00:00.000Z',
      },
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('1 conflict')).toBeInTheDocument();
    });
  });

  it('renders plural conflict badge when multiple conflicts exist', async () => {
    mockGetConflictDrafts.execute.mockResolvedValue([
      {
        id: 'draft-1',
        documentId: 'doc-1',
        baseVersion: 1,
        serverVersion: 2,
        localContent: 'local 1',
        serverContent: 'server 1',
        createdAt: '2026-08-27T10:00:00.000Z',
      },
      {
        id: 'draft-2',
        documentId: 'doc-2',
        baseVersion: 1,
        serverVersion: 2,
        localContent: 'local 2',
        serverContent: 'server 2',
        createdAt: '2026-08-27T10:00:00.000Z',
      },
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('2 conflicts')).toBeInTheDocument();
    });
  });

  it('opens ConflictDraftsModal when clicked with conflicts', async () => {
    mockGetConflictDrafts.execute.mockResolvedValue([
      {
        id: 'draft-1',
        documentId: 'doc-1',
        baseVersion: 1,
        serverVersion: 2,
        localContent: 'local content',
        serverContent: 'server content',
        createdAt: '2026-08-27T10:00:00.000Z',
      },
    ]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('1 conflict')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /conflict/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Resolve Sync Conflicts')).toBeInTheDocument();
  });

  it('triggers manual sync when clicked in idle state', async () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button'));

    expect(mockTriggerSync.execute).toHaveBeenCalledTimes(1);
  });

  it('renders "Paused" state when standby with reconnection tooltip', () => {
    mockStore.setState({ state: 'standby' });
    renderComponent();
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Cloud sync paused — tap to reconnect')
    );
  });

  it('triggers re-auth login via preflight dialog when clicked in standby state', async () => {
    mockStore.setState({ state: 'standby' });
    renderComponent();

    fireEvent.click(screen.getByRole('button'));

    expect(mockAuth.login).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connect Google Drive' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Connect Google Drive' }));

    expect(mockAuth.login).toHaveBeenCalledTimes(1);
    expect(mockTriggerSync.execute).not.toHaveBeenCalled();
  });

  it('renders resting "Standby" affordance when unauthenticated with settings tooltip', () => {
    mockAuth.getStatus.mockReturnValue('unauthenticated');
    renderComponent();
    expect(screen.getByText('Standby')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Local storage')
    );
  });

  it('triggers auth login via preflight dialog when clicked in unauthenticated state', async () => {
    mockAuth.getStatus.mockReturnValue('unauthenticated');
    renderComponent();

    fireEvent.click(screen.getByRole('button'));

    expect(mockAuth.login).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connect Google Drive' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Connect Google Drive' }));

    expect(mockAuth.login).toHaveBeenCalledTimes(1);
  });

  it('cancels connect preflight without invoking auth login when canceled', async () => {
    mockAuth.getStatus.mockReturnValue('unauthenticated');
    renderComponent();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockAuth.login).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not display error state or pending badge when unauthenticated even if store has errors', () => {
    mockAuth.getStatus.mockReturnValue('unauthenticated');
    mockStore.setState({ state: 'error', pendingCount: 5, lastError: 'Fatal network drop' });

    renderComponent();

    expect(screen.getByText('Standby')).toBeInTheDocument();
    expect(screen.queryByText('Sync error')).not.toBeInTheDocument();
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('renders "Paused" state when paused with tap-to-resume tooltip', () => {
    mockStore.setState({ state: 'paused' });
    renderComponent();
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Cloud sync paused — tap to resume')
    );
  });

  it('exposes selected-library identity in the tooltip / accessible label (Requirement 2)', () => {
    renderComponent();
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Account Library (test-user-sub) • Synced'
    );
  });

  it('exposes Local-only Library • Local storage in tooltip when local-only', () => {
    mockAuth.getStatus.mockReturnValue('unauthenticated');
    renderComponent();
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Local-only Library • Local storage'
    );
  });

  it('triggers resume when clicked in paused state', async () => {
    mockStore.setState({ state: 'paused' });
    renderComponent();

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockSyncEngine.resume).toHaveBeenCalled();
    });
  });
});
