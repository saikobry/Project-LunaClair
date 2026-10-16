import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SyncSettingsSection } from '../SyncSettingsSection';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { SyncStatusStore } from '../../../../application/sync/SyncStatusStore';
import type {
  GoogleAuthPort,
  GoogleAuthSession,
  AuthStatus,
} from '../../../../domain/auth/models/auth.types';

describe('SyncSettingsSection', () => {
  let mockStore: SyncStatusStore;
  let mockTriggerSync: { execute: ReturnType<typeof vi.fn> };
  let mockAuthService: GoogleAuthPort;
  let authListeners: Set<(session: GoogleAuthSession | null) => void>;
  let currentSession: GoogleAuthSession | null;
  let currentStatus: AuthStatus;
  let mockContext: any;

  const sampleSession: GoogleAuthSession = {
    user: {
      sub: 'google-sub-456',
      name: 'Luna Researcher',
      email: 'researcher@lunaclair.dev',
      picture: 'https://example.com/avatar.jpg',
    },
    tokens: {
      accessToken: 'valid-token',
      expiresAt: Date.now() + 3600 * 1000,
      sealedRefreshToken: 'sealed-token',
    },
  };

  beforeEach(() => {
    mockStore = new SyncStatusStore({
      state: 'idle',
      pendingCount: 0,
      lastSyncedAt: new Date().toISOString(),
    });

    mockTriggerSync = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    authListeners = new Set();
    currentSession = null;
    currentStatus = 'unauthenticated';

    mockAuthService = {
      login: vi.fn().mockImplementation(async () => {
        currentSession = sampleSession;
        currentStatus = 'authenticated';
        for (const l of authListeners) l(currentSession);
        return sampleSession;
      }),
      logout: vi.fn().mockImplementation(async () => {
        currentSession = null;
        currentStatus = 'unauthenticated';
        for (const l of authListeners) l(null);
      }),
      getSession: vi.fn().mockImplementation(() => currentSession),
      getStatus: vi.fn().mockImplementation(() => currentStatus),
      subscribe: vi.fn().mockImplementation((listener) => {
        authListeners.add(listener);
        return () => {
          authListeners.delete(listener);
        };
      }),
      getValidAccessToken: vi.fn().mockResolvedValue('valid-token'),
    };

    mockContext = {
      useCases: {
        sync: {
          syncStatusStore: mockStore,
          getConflictDrafts: { execute: vi.fn().mockResolvedValue([]) },
          triggerSync: mockTriggerSync,
          resolveConflictDraft: { execute: vi.fn().mockResolvedValue(undefined) },
        },
      },
      infrastructure: {
        providers: {
          auth: mockAuthService,
        },
      },
    };
  });

  function renderSection(authOverride?: GoogleAuthPort) {
    return render(
      <ApplicationContext.Provider value={mockContext}>
        <SyncSettingsSection authService={authOverride} />
      </ApplicationContext.Provider>
    );
  }

  it('renders unauthenticated state with title, description, connect button, and sync now button', () => {
    renderSection();

    expect(screen.getByRole('heading', { name: 'Google Drive Cloud Sync' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Store and sync your notes, cards, and quiz history directly to your personal Google Drive appDataFolder. Zero server storage, 100% user-owned.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Google Drive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync Now' })).toBeInTheDocument();
    expect(screen.getAllByText('Connect Google Drive to synchronize').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Disconnect')).not.toBeInTheDocument();
  });

  it('invokes login action when Sync Now button is clicked while unauthenticated', async () => {
    renderSection();

    const syncNowBtn = screen.getByRole('button', { name: 'Sync Now' });
    fireEvent.click(syncNowBtn);

    expect(mockAuthService.login).toHaveBeenCalledTimes(1);
  });

  it('invokes login action when Connect Google Drive button is clicked', async () => {
    renderSection();

    const connectBtn = screen.getByRole('button', { name: 'Connect Google Drive' });
    fireEvent.click(connectBtn);

    expect(mockAuthService.login).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText('Luna Researcher')).toBeInTheDocument();
      expect(screen.getByText('researcher@lunaclair.dev')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sync Now' })).toBeInTheDocument();
    });
  });

  it('renders user profile, avatar, and disconnect button when authenticated', () => {
    currentSession = sampleSession;
    currentStatus = 'authenticated';

    renderSection();

    expect(screen.getByText('Luna Researcher')).toBeInTheDocument();
    expect(screen.getByText('researcher@lunaclair.dev')).toBeInTheDocument();
    const avatar = screen.getByAltText('Luna Researcher');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync Now' })).toBeInTheDocument();
  });

  it('renders fallback avatar when profile has no picture', () => {
    currentSession = {
      ...sampleSession,
      user: { ...sampleSession.user, picture: undefined },
    };
    currentStatus = 'authenticated';

    renderSection();

    expect(screen.getByText('Luna Researcher')).toBeInTheDocument();
    expect(screen.queryByAltText('Luna Researcher')).not.toBeInTheDocument();
  });

  it('triggers sync use case when Sync Now button is clicked', async () => {
    currentSession = sampleSession;
    currentStatus = 'authenticated';

    renderSection();

    const syncNowBtn = screen.getByRole('button', { name: 'Sync Now' });
    fireEvent.click(syncNowBtn);

    expect(mockTriggerSync.execute).toHaveBeenCalledTimes(1);
  });

  it('invokes logout when Disconnect button is clicked', async () => {
    currentSession = sampleSession;
    currentStatus = 'authenticated';

    renderSection();

    const disconnectBtn = screen.getByRole('button', { name: 'Disconnect' });
    fireEvent.click(disconnectBtn);

    expect(mockAuthService.logout).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Connect Google Drive' })).toBeInTheDocument();
      expect(screen.queryByText('Luna Researcher')).not.toBeInTheDocument();
    });
  });

  it('renders "synced" status badge when idle', () => {
    currentSession = sampleSession;
    currentStatus = 'authenticated';
    mockStore.setState({ state: 'idle' });

    renderSection();

    const badge = screen.getByTestId('sync-status-badge');
    expect(badge).toHaveAttribute('data-status', 'synced');
    expect(screen.getByText('Synced')).toBeInTheDocument();
  });

  it('renders "syncing" status badge when sync is active', () => {
    currentSession = sampleSession;
    currentStatus = 'authenticated';
    mockStore.setState({ state: 'syncing' });

    renderSection();

    const badge = screen.getByTestId('sync-status-badge');
    expect(badge).toHaveAttribute('data-status', 'syncing');
    expect(screen.getByText('Syncing')).toBeInTheDocument();
  });

  it('renders "standby" status badge when auth or store is in standby', () => {
    currentSession = sampleSession;
    currentStatus = 'standby';

    renderSection();

    const badge = screen.getByTestId('sync-status-badge');
    expect(badge).toHaveAttribute('data-status', 'standby');
    expect(screen.getByText('Standby')).toBeInTheDocument();
  });

  it('renders "error" status badge when sync encounters an error', () => {
    currentSession = sampleSession;
    currentStatus = 'authenticated';
    mockStore.setState({ state: 'error', lastError: 'Network down' });

    renderSection();

    const badge = screen.getByTestId('sync-status-badge');
    expect(badge).toHaveAttribute('data-status', 'error');
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});
