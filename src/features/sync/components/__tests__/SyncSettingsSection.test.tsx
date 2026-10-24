import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SyncSettingsSection } from '../SyncSettingsSection';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { SyncStatusStore } from '../../../../application/sync/SyncStatusStore';
import { SyncCategoryPreferences } from '../../services/SyncCategoryPreferences';
import type {
  GoogleAuthPort,
  GoogleAuthSession,
  AuthStatus,
} from '../../../../domain/auth/models/auth.types';
import type { VaultRegistryPort } from '../../../../domain/vault/models/vault.types';

describe('SyncSettingsSection', () => {
  let mockStore: SyncStatusStore;
  let mockTriggerSync: { execute: ReturnType<typeof vi.fn> };
  let mockToggleCategory: { execute: ReturnType<typeof vi.fn> };
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

    mockToggleCategory = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockContext = {
      switchActiveLibrary: vi.fn().mockResolvedValue(undefined),
      useCases: {
        sync: {
          syncStatusStore: mockStore,
          getConflictDrafts: { execute: vi.fn().mockResolvedValue([]) },
          triggerSync: mockTriggerSync,
          resolveConflictDraft: { execute: vi.fn().mockResolvedValue(undefined) },
          toggleCategory: mockToggleCategory,
        },
      },
      infrastructure: {
        providers: {
          auth: mockAuthService,
        },
      },
    };
  });

  function renderSection(authOverride?: GoogleAuthPort, extraProps?: any) {
    return render(
      <ApplicationContext.Provider value={mockContext}>
        <SyncSettingsSection authService={authOverride} {...extraProps} />
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

    // Displays preflight confirmation dialog (Requirement 3)
    expect(screen.getByText('Connect Google Drive', { selector: 'h2, [role="heading"]' })).toBeInTheDocument();
    const connectButtons = screen.getAllByRole('button', { name: 'Connect Google Drive' });
    const dialogConfirmBtn = connectButtons[connectButtons.length - 1];
    fireEvent.click(dialogConfirmBtn);

    expect(mockAuthService.login).toHaveBeenCalledTimes(1);
  });

  it('invokes login action when Connect Google Drive button is clicked', async () => {
    renderSection();

    const connectBtn = screen.getByRole('button', { name: 'Connect Google Drive' });
    fireEvent.click(connectBtn);

    // Displays preflight confirmation dialog (Requirement 3)
    const connectButtons = screen.getAllByRole('button', { name: 'Connect Google Drive' });
    const dialogConfirmBtn = connectButtons[connectButtons.length - 1];
    fireEvent.click(dialogConfirmBtn);

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

  describe('Selective Sync Category Controls', () => {
    it('renders the Selective Sync section with heading and description', () => {
      renderSection();

      expect(screen.getByRole('heading', { name: 'Selective Sync' })).toBeInTheDocument();
      expect(
        screen.getByText(/Choose which data categories synchronize with your cloud storage/i)
      ).toBeInTheDocument();
    });

    it('renders all 4 accessible category toggle switches with default enabled state', () => {
      renderSection();

      const annotationsSwitch = screen.getByRole('switch', { name: 'Annotations' });
      const flashcardsSwitch = screen.getByRole('switch', { name: 'Spaced Repetition' });
      const quizHistorySwitch = screen.getByRole('switch', { name: 'Quiz History & Scores' });
      const customMaterialsSwitch = screen.getByRole('switch', { name: 'Custom Materials' });

      expect(annotationsSwitch).toBeInTheDocument();
      expect(annotationsSwitch).toBeChecked();

      expect(flashcardsSwitch).toBeInTheDocument();
      expect(flashcardsSwitch).toBeChecked();

      expect(quizHistorySwitch).toBeInTheDocument();
      expect(quizHistorySwitch).toBeChecked();

      expect(customMaterialsSwitch).toBeInTheDocument();
      expect(customMaterialsSwitch).toBeChecked();

      expect(screen.getByText('Highlights & Drawings')).toBeInTheDocument();
      expect(screen.getByText('Flashcard Review History')).toBeInTheDocument();
      expect(screen.getByText('Quiz sessions, attempts, and historical scores')).toBeInTheDocument();
      expect(screen.getByText('Custom materials, questions, quizzes, and authored notes')).toBeInTheDocument();
    });

    it('invokes toggleCategory use case when a switch is clicked', async () => {
      renderSection();

      const annotationsSwitch = screen.getByRole('switch', { name: 'Annotations' });
      fireEvent.click(annotationsSwitch);

      expect(mockToggleCategory.execute).toHaveBeenCalledWith('annotations', false);
    });

    it('invokes onToggleCategory prop when supplied', async () => {
      const handleToggle = vi.fn();
      renderSection(undefined, { onToggleCategory: handleToggle });

      const flashcardsSwitch = screen.getByRole('switch', { name: 'Spaced Repetition' });
      fireEvent.click(flashcardsSwitch);

      expect(handleToggle).toHaveBeenCalledWith('flashcards', false);
    });

    it('reflects custom preferences passed through categoryPreferences prop', () => {
      const customPrefs = new SyncCategoryPreferences({
        getItem: () =>
          JSON.stringify({
            annotations: false,
            flashcards: true,
            quizHistory: false,
            customMaterials: true,
          }),
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      });

      renderSection(undefined, { categoryPreferences: customPrefs });

      expect(screen.getByRole('switch', { name: 'Annotations' })).not.toBeChecked();
      expect(screen.getByRole('switch', { name: 'Spaced Repetition' })).toBeChecked();
      expect(screen.getByRole('switch', { name: 'Quiz History & Scores' })).not.toBeChecked();
      expect(screen.getByRole('switch', { name: 'Custom Materials' })).toBeChecked();
    });
  });

  describe('First-Connect Notice & Library Switch Confirmation', () => {
    it('displays first-connect explanation and coexisting library notice when unauthenticated (Requirement 3)', () => {
      renderSection();

      expect(
        screen.getByText(
          'Connecting Google Drive links your local library to your Google account for private cloud backup. If this account already has an existing library on this device, connecting will open your account library while keeping your local-only library intact and switchable at any time.'
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          'Libraries are not automatically merged. All data remains stored locally on this device.'
        )
      ).toBeInTheDocument();
    });

    it('requires confirmation before switching to local-only library in retained account state (Requirement 2)', async () => {
      mockContext.infrastructure.expectedSub = 'retained-account-user';
      renderSection();

      const switchBtn = screen.getByRole('button', { name: 'Switch to Local-only Library' });
      expect(switchBtn).toBeInTheDocument();

      // Click switch — should open confirmation dialog, NOT switch immediately
      fireEvent.click(switchBtn);

      expect(screen.getByText('Switch Active Library?')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Switching libraries changes the active local database. Any unsaved drafts in the editor will be discarded.'
        )
      ).toBeInTheDocument();
      expect(mockContext.switchActiveLibrary).not.toHaveBeenCalled();

      // Cancel dismissal
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(screen.queryByText('Switch Active Library?')).not.toBeInTheDocument();
      });
      expect(mockContext.switchActiveLibrary).not.toHaveBeenCalled();

      // Re-open and confirm
      fireEvent.click(switchBtn);
      const confirmBtn = screen.getByRole('button', { name: 'Confirm Switch' });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockContext.switchActiveLibrary).toHaveBeenCalledWith('ANONYMOUS');
      });
    });

    it('requires confirmation before switching to local-only library in authenticated state (Requirement 2)', async () => {
      currentSession = sampleSession;
      currentStatus = 'authenticated';
      renderSection();

      const switchBtn = screen.getByRole('button', { name: 'Switch to Local-only Library' });
      expect(switchBtn).toBeInTheDocument();

      fireEvent.click(switchBtn);

      expect(screen.getByText('Switch Active Library?')).toBeInTheDocument();
      expect(mockContext.switchActiveLibrary).not.toHaveBeenCalled();

      const confirmBtn = screen.getByRole('button', { name: 'Confirm Switch' });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockContext.switchActiveLibrary).toHaveBeenCalledWith('ANONYMOUS');
      });
    });

    it('identifies selected local-only library truthfully while Google remains connected (Requirement 1)', () => {
      currentSession = sampleSession;
      currentStatus = 'authenticated';
      mockContext.infrastructure.expectedSub = 'ANONYMOUS';
      renderSection();

      expect(screen.getByText('Local-only Library', { exact: true })).toBeInTheDocument();
      expect(screen.getByText('All study materials, cards, and quiz history are stored locally on this device in IndexedDB. Fully accessible offline.')).toBeInTheDocument();
      expect(screen.queryByText('Connected account library. All data is stored locally on this device and works offline. Edits sync automatically with your personal Google Drive.')).not.toBeInTheDocument();
      expect(screen.getByText('Switch to Account Library (researcher@lunaclair.dev)')).toBeInTheDocument();
      expect(screen.getByTestId('sync-status-badge')).toHaveTextContent('Local only');
    });

  const createMockRegistry = (
    vaults: Array<{ ownerSub: string; physicalDbName: string }> = []
  ): VaultRegistryPort => ({
    listVaults: vi.fn().mockResolvedValue(
      vaults.map((v) => ({
        ownerSub: v.ownerSub,
        physicalDbName: v.physicalDbName,
        createdAt: 0,
        lastActiveAt: 0,
      }))
    ),
    getActiveVault: vi.fn().mockRejectedValue(new Error('getActiveVault should not be called')),
    promoteAnonymousVault: vi.fn().mockRejectedValue(new Error('promoteAnonymousVault should not be called')),
    switchActiveVault: vi.fn().mockRejectedValue(new Error('switchActiveVault should not be called')),
    deleteVault: vi.fn().mockRejectedValue(new Error('deleteVault should not be called')),
  });

    it('displays informational collision notice with no duplicate button, exactly one standard switch button, and switches to ANONYMOUS after confirmation', async () => {
      currentSession = sampleSession;
      currentStatus = 'authenticated';
      const mockVaultRegistry = createMockRegistry([
        { ownerSub: 'ANONYMOUS', physicalDbName: 'lc_vault_anon' },
      ]);

      renderSection(undefined, {
        lastPromotionResult: { collisionFromAnonDb: 'lc_vault_anon' },
        vaultRegistry: mockVaultRegistry,
      });

      const collisionNotice = await screen.findByTestId('collision-notice');
      expect(collisionNotice).toBeInTheDocument();
      expect(collisionNotice).toHaveTextContent(
        'Your prior local-only library remains separate on this device. Use the "Switch to Local-only Library" action below to open it at any time.'
      );

      // Alert has NO button (switch-to-preserved-local-button does not exist)
      expect(screen.queryByTestId('switch-to-preserved-local-button')).not.toBeInTheDocument();

      // Exactly one standard switch button exists
      const localSwitchButtons = screen.getAllByTestId('switch-to-local-library-button');
      expect(localSwitchButtons).toHaveLength(1);
      const switchBtn = localSwitchButtons[0];

      // Clicking opens confirmation dialog and switches only after confirmation
      fireEvent.click(switchBtn);

      expect(screen.getByText('Switch Active Library?')).toBeInTheDocument();
      expect(mockContext.switchActiveLibrary).not.toHaveBeenCalled();

      const confirmBtn = screen.getByRole('button', { name: 'Confirm Switch' });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockContext.switchActiveLibrary).toHaveBeenCalledWith('ANONYMOUS');
      });

      // Prove read-only inspection
      expect(mockVaultRegistry.listVaults).toHaveBeenCalled();
      expect(mockVaultRegistry.getActiveVault).not.toHaveBeenCalled();
      expect(mockVaultRegistry.promoteAnonymousVault).not.toHaveBeenCalled();
      expect(mockVaultRegistry.switchActiveVault).not.toHaveBeenCalled();
      expect(mockVaultRegistry.deleteVault).not.toHaveBeenCalled();
    });

    it('omits collision notice when anonymous pointer does not match collisionDbName', async () => {
      currentSession = sampleSession;
      currentStatus = 'authenticated';
      const mockVaultRegistry = createMockRegistry([
        { ownerSub: 'ANONYMOUS', physicalDbName: 'lc_vault_other_db' },
      ]);

      renderSection(undefined, {
        lastPromotionResult: { collisionFromAnonDb: 'lc_vault_anon' },
        vaultRegistry: mockVaultRegistry,
      });

      await waitFor(() => {
        expect(mockVaultRegistry.listVaults).toHaveBeenCalled();
      });

      expect(screen.queryByTestId('collision-notice')).not.toBeInTheDocument();
      expect(mockVaultRegistry.getActiveVault).not.toHaveBeenCalled();
    });

    it('omits collision notice when matching db belongs to another owner rather than ANONYMOUS', async () => {
      currentSession = sampleSession;
      currentStatus = 'authenticated';
      const mockVaultRegistry = createMockRegistry([
        { ownerSub: 'different-user-sub', physicalDbName: 'lc_vault_anon' },
      ]);

      renderSection(undefined, {
        lastPromotionResult: { collisionFromAnonDb: 'lc_vault_anon' },
        vaultRegistry: mockVaultRegistry,
      });

      await waitFor(() => {
        expect(mockVaultRegistry.listVaults).toHaveBeenCalled();
      });

      expect(screen.queryByTestId('collision-notice')).not.toBeInTheDocument();
      expect(mockVaultRegistry.getActiveVault).not.toHaveBeenCalled();
    });

    it('omits collision notice when listVaults returns an empty list', async () => {
      currentSession = sampleSession;
      currentStatus = 'authenticated';
      const mockVaultRegistry = createMockRegistry([]);

      renderSection(undefined, {
        lastPromotionResult: { collisionFromAnonDb: 'lc_vault_anon' },
        vaultRegistry: mockVaultRegistry,
      });

      await waitFor(() => {
        expect(mockVaultRegistry.listVaults).toHaveBeenCalled();
      });

      expect(screen.queryByTestId('collision-notice')).not.toBeInTheDocument();
      expect(mockVaultRegistry.getActiveVault).not.toHaveBeenCalled();
    });

    it('omits collision notice when listVaults rejects', async () => {
      currentSession = sampleSession;
      currentStatus = 'authenticated';
      const mockVaultRegistry = createMockRegistry();
      mockVaultRegistry.listVaults = vi.fn().mockRejectedValue(new Error('Registry read failure'));

      renderSection(undefined, {
        lastPromotionResult: { collisionFromAnonDb: 'lc_vault_anon' },
        vaultRegistry: mockVaultRegistry,
      });

      await waitFor(() => {
        expect(mockVaultRegistry.listVaults).toHaveBeenCalled();
      });

      expect(screen.queryByTestId('collision-notice')).not.toBeInTheDocument();
      expect(mockVaultRegistry.getActiveVault).not.toHaveBeenCalled();
    });

    it('omits collision notice and does not query registry when collisionFromAnonDb is missing', () => {
      currentSession = sampleSession;
      currentStatus = 'authenticated';
      const mockVaultRegistry = createMockRegistry([
        { ownerSub: 'ANONYMOUS', physicalDbName: 'lc_vault_anon' },
      ]);

      renderSection(undefined, {
        lastPromotionResult: {},
        vaultRegistry: mockVaultRegistry,
      });

      expect(screen.queryByTestId('collision-notice')).not.toBeInTheDocument();
      expect(mockVaultRegistry.listVaults).not.toHaveBeenCalled();
      expect(mockVaultRegistry.getActiveVault).not.toHaveBeenCalled();
    });

    it('resolves vaultRegistry from application context when not provided via props', async () => {
      currentSession = sampleSession;
      currentStatus = 'authenticated';
      const mockVaultRegistry = createMockRegistry([
        { ownerSub: 'ANONYMOUS', physicalDbName: 'lc_vault_anon' },
      ]);
      mockContext.infrastructure.vaultRegistry = mockVaultRegistry;

      renderSection(undefined, {
        lastPromotionResult: { collisionFromAnonDb: 'lc_vault_anon' },
      });

      const collisionNotice = await screen.findByTestId('collision-notice');
      expect(collisionNotice).toBeInTheDocument();
      expect(mockVaultRegistry.listVaults).toHaveBeenCalled();
      expect(mockVaultRegistry.getActiveVault).not.toHaveBeenCalled();
    });

    it('cancelling connect preflight dialog does not invoke login (Requirement 3)', () => {
      renderSection();

      const connectBtn = screen.getByRole('button', { name: 'Connect Google Drive' });
      fireEvent.click(connectBtn);

      expect(screen.getByText('Connect Google Drive', { selector: 'h2, [role="heading"]' })).toBeInTheDocument();
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelBtn);

      expect(mockAuthService.login).not.toHaveBeenCalled();
    });
  });
});
