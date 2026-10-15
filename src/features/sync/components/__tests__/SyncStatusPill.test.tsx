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

    mockAuth = {
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      getSession: vi.fn().mockReturnValue(null),
      getStatus: vi.fn().mockReturnValue('authenticated'),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getValidAccessToken: vi.fn().mockResolvedValue('token'),
    };

    mockContext = {
      useCases: {
        sync: {
          syncStatusStore: mockStore,
          getConflictDrafts: mockGetConflictDrafts,
          triggerSync: mockTriggerSync,
          resolveConflictDraft: mockResolveConflictDraft,
        },
      },
      infrastructure: {
        providers: {
          auth: mockAuth,
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
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Cloud sync paused — tap to reconnect');
  });

  it('triggers re-auth login when clicked in standby state', async () => {
    mockStore.setState({ state: 'standby' });
    renderComponent();

    fireEvent.click(screen.getByRole('button'));

    expect(mockAuth.login).toHaveBeenCalledTimes(1);
    expect(mockTriggerSync.execute).not.toHaveBeenCalled();
  });

  it('renders resting "Standby" affordance when unauthenticated with settings tooltip', () => {
    mockAuth.getStatus.mockReturnValue('unauthenticated');
    renderComponent();
    expect(screen.getByText('Standby')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Sync offline - connect Google Drive in Settings'
    );
  });

  it('triggers auth login when clicked in unauthenticated state', async () => {
    mockAuth.getStatus.mockReturnValue('unauthenticated');
    renderComponent();

    fireEvent.click(screen.getByRole('button'));

    expect(mockAuth.login).toHaveBeenCalledTimes(1);
  });

  it('does not display error state or pending badge when unauthenticated even if store has errors', () => {
    mockAuth.getStatus.mockReturnValue('unauthenticated');
    mockStore.setState({ state: 'error', pendingCount: 5, lastError: 'Fatal network drop' });

    renderComponent();

    expect(screen.getByText('Standby')).toBeInTheDocument();
    expect(screen.queryByText('Sync error')).not.toBeInTheDocument();
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });
});
