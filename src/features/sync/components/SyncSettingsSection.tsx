import { useState, useEffect, useContext, useCallback, useSyncExternalStore } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  CheckCircle2,
  RefreshCw,
  PauseCircle,
  AlertCircle,
  Database,
  User,
} from 'lucide-react';
import { Card } from '../../../shared/ui/Card/Card';
import { Button } from '../../../shared/ui/Button/Button';
import { ConfirmationDialog } from '../../../shared/ui/Dialog/ConfirmationDialog';
import { Switch } from '../../../shared/ui/Switch/Switch';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import {
  ANONYMOUS_OWNER_SUB,
  type VaultRegistryPort,
} from '../../../domain/vault/models/vault.types';
import { STORAGE_KEYS } from '../../../shared/constants/storageKeys';
import type {
  GoogleAuthPort,
  GoogleAuthSession,
  AuthStatus,
} from '../../../domain/auth/models/auth.types';
import { useSyncStatus } from '../hooks/useSyncStatus';
import {
  useSyncCategoryPreferences,
  syncCategoryPreferences,
  type SyncCategoryKey,
  type SyncCategoryPreferences,
} from '../services/SyncCategoryPreferences';
import { syncSettingsStyles } from './syncSettings.stylex';

export interface SyncSettingsSectionProps {
  authService?: GoogleAuthPort;
  categoryPreferences?: SyncCategoryPreferences;
  onToggleCategory?: (category: SyncCategoryKey, enabled: boolean) => Promise<void> | void;
  lastPromotionResult?: { collisionFromAnonDb?: string };
  vaultRegistry?: VaultRegistryPort;
}

export type SyncBadgeStatus = 'synced' | 'syncing' | 'standby' | 'error' | 'paused';

/**
 * Settings section for Google Drive Bring-Your-Own-Storage (BYOS) cloud sync.
 * Governed by ADR-018.
 */
export function SyncSettingsSection({
  authService: propAuthService,
  categoryPreferences: propCategoryPreferences,
  onToggleCategory,
  lastPromotionResult: propLastPromotionResult,
  vaultRegistry: propVaultRegistry,
}: SyncSettingsSectionProps) {
  const context = useContext(ApplicationContext);
  const auth = propAuthService ?? context?.infrastructure?.providers?.auth;
  const registry = propVaultRegistry ?? (context?.infrastructure as any)?.vaultRegistry;

  const session: GoogleAuthSession | null = useSyncExternalStore(
    (notify) => auth?.subscribe(notify) ?? (() => {}),
    () => auth?.getSession() ?? null,
    () => auth?.getSession() ?? null,
  );
  const authStatus: AuthStatus = useSyncExternalStore(
    (notify) => auth?.subscribe(notify) ?? (() => {}),
    () => auth?.getStatus() ?? 'unauthenticated',
    () => auth?.getStatus() ?? 'unauthenticated',
  );

  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isConfirmingConnect, setIsConfirmingConnect] = useState(false);
  const [switchingTarget, setSwitchingTarget] = useState<string | null>(null);

  const {
    state: syncState,
    triggerSync,
    isPaused,
    pauseSync,
    resumeSync,
  } = useSyncStatus();

  const { preferences, setCategoryEnabled } = useSyncCategoryPreferences(
    propCategoryPreferences ?? syncCategoryPreferences
  );

  const handleToggleCategory = useCallback(
    async (category: SyncCategoryKey, nextValue: boolean) => {
      if (onToggleCategory) {
        await onToggleCategory(category, nextValue);
        return;
      }
      const syncUseCases = context?.useCases?.sync as
        | { toggleCategory?: { execute: (c: SyncCategoryKey, e: boolean) => Promise<void> } }
        | undefined;
      if (syncUseCases?.toggleCategory) {
        await syncUseCases.toggleCategory.execute(category, nextValue);
      } else {
        setCategoryEnabled(category, nextValue);
      }
    },
    [onToggleCategory, context, setCategoryEnabled]
  );

  const handleExecuteConnect = useCallback(async () => {
    if (!auth) return;
    setIsConnecting(true);
    setAuthError(null);
    try {
      await auth.login();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to connect Google Drive.');
    } finally {
      setIsConnecting(false);
    }
  }, [auth]);

  const handleDisconnect = useCallback(async () => {
    if (!auth) return;
    setAuthError(null);
    try {
      await auth.logout();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to disconnect account.');
    }
  }, [auth]);

  const handleSyncNow = useCallback(async () => {
    setAuthError(null);
    try {
      await triggerSync();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sync execution failed.');
    }
  }, [triggerSync]);

  const isAuthenticated = Boolean(session) && authStatus !== 'unauthenticated';
  const activeOwnerSub =
    context?.infrastructure?.expectedSub ??
    (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.vault.activeOwnerSub) : null) ??
    (session?.user?.sub ? session.user.sub : ANONYMOUS_OWNER_SUB);

  const isLocalOnly =
    !activeOwnerSub ||
    activeOwnerSub === ANONYMOUS_OWNER_SUB ||
    activeOwnerSub === 'anonymous';

  const isConnectedAccountActive =
    !isLocalOnly &&
    isAuthenticated &&
    activeOwnerSub === session?.user?.sub;

  const lastPromotionResult =
    propLastPromotionResult ??
    (auth as any)?.getLastPromotionResult?.() ??
    (context?.infrastructure as any)?.lastPromotionResult;
  const collisionDbName = lastPromotionResult?.collisionFromAnonDb;

  const [verifiedDbName, setVerifiedDbName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!collisionDbName || typeof registry?.listVaults !== 'function') {
      return;
    }

    registry
      .listVaults()
      .then((vaults: any[]) => {
        if (cancelled) return;
        const matches =
          Array.isArray(vaults) &&
          vaults.some(
            (v) => v.ownerSub === ANONYMOUS_OWNER_SUB && v.physicalDbName === collisionDbName
          );
        if (matches) {
          setVerifiedDbName(collisionDbName);
        } else {
          setVerifiedDbName(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVerifiedDbName(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [collisionDbName, registry]);

  const hasVerifiedCollision = Boolean(collisionDbName) && verifiedDbName === collisionDbName;

  const computeBadgeStatus = (): SyncBadgeStatus => {
    if (isPaused || syncState === 'paused') return 'paused';
    if (authStatus === 'standby' || syncState === 'standby') return 'standby';
    if (syncState === 'syncing') return 'syncing';
    if (syncState === 'error') return 'error';
    return 'synced';
  };

  const badgeStatus = computeBadgeStatus();

  const renderBadge = () => {
    switch (badgeStatus) {
      case 'paused':
        return (
          <span
            {...stylex.props(syncSettingsStyles.badge, syncSettingsStyles.badgePaused)}
            data-status="paused"
            data-testid="sync-status-badge"
          >
            <PauseCircle size={13} />
            <span>Paused</span>
          </span>
        );
      case 'syncing':
        return (
          <span
            {...stylex.props(syncSettingsStyles.badge, syncSettingsStyles.badgeSyncing)}
            data-status="syncing"
            data-testid="sync-status-badge"
          >
            <RefreshCw size={13} />
            <span>Syncing</span>
          </span>
        );
      case 'standby':
        return (
          <span
            {...stylex.props(syncSettingsStyles.badge, syncSettingsStyles.badgeStandby)}
            data-status="standby"
            data-testid="sync-status-badge"
          >
            <PauseCircle size={13} />
            <span>Standby</span>
          </span>
        );
      case 'error':
        return (
          <span
            {...stylex.props(syncSettingsStyles.badge, syncSettingsStyles.badgeError)}
            data-status="error"
            data-testid="sync-status-badge"
          >
            <AlertCircle size={13} />
            <span>Error</span>
          </span>
        );
      case 'synced':
      default:
        return (
          <span
            {...stylex.props(syncSettingsStyles.badge, syncSettingsStyles.badgeSynced)}
            data-status="synced"
            data-testid="sync-status-badge"
          >
            <CheckCircle2 size={13} />
            <span>Synced</span>
          </span>
        );
    }
  };

  return (
    <section {...stylex.props(syncSettingsStyles.section)} aria-labelledby="settings-sync-heading">
      <h2 {...stylex.props(syncSettingsStyles.heading)} id="settings-sync-heading">
        Google Drive Cloud Sync
      </h2>
      <p {...stylex.props(syncSettingsStyles.description)}>
        Store and sync your notes, cards, and quiz history directly to your personal Google Drive appDataFolder. Zero server storage, 100% user-owned.
      </p>

      <Card>
        <div {...stylex.props(syncSettingsStyles.cardContent)}>
          {authError && (
            <div {...stylex.props(syncSettingsStyles.errorMessage)} role="alert">
              {authError}
            </div>
          )}

          {isLocalOnly ? (
            <div {...stylex.props(syncSettingsStyles.unauthContent)}>
              <div {...stylex.props(syncSettingsStyles.statusHeader)}>
                <div {...stylex.props(syncSettingsStyles.titleWithBadgeRow)}>
                  <span {...stylex.props(syncSettingsStyles.statusTitle)}>
                    Local-only Library
                  </span>
                  <span
                    {...stylex.props(syncSettingsStyles.badge, syncSettingsStyles.badgeLocal)}
                    data-status="standby"
                    data-testid="sync-status-badge"
                  >
                    <Database size={13} />
                    <span>Local only</span>
                  </span>
                </div>
                <p {...stylex.props(syncSettingsStyles.statusDescription)}>
                  All study materials, cards, and quiz history are stored locally on this device in IndexedDB. Fully accessible offline.
                </p>
              </div>

              {isAuthenticated && session ? (
                <div {...stylex.props(syncSettingsStyles.connectedAccountCard)}>
                  <div {...stylex.props(syncSettingsStyles.profileRow)}>
                    <div {...stylex.props(syncSettingsStyles.userInfo)}>
                      {session.user.picture ? (
                        <img
                          src={session.user.picture}
                          alt={session.user.name}
                          {...stylex.props(syncSettingsStyles.avatar)}
                        />
                      ) : (
                        <div {...stylex.props(syncSettingsStyles.avatarFallback)}>
                          <User size={22} />
                        </div>
                      )}
                      <div {...stylex.props(syncSettingsStyles.userMeta)}>
                        <span {...stylex.props(syncSettingsStyles.userName)}>
                          {session.user.name}
                        </span>
                        <span {...stylex.props(syncSettingsStyles.userEmail)}>
                          {session.user.email}
                        </span>
                      </div>
                    </div>
                    <span
                      {...stylex.props(syncSettingsStyles.badge, syncSettingsStyles.badgeSynced)}
                      data-testid="drive-connected-badge"
                    >
                      <CheckCircle2 size={13} />
                      <span>Google Drive Connected</span>
                    </span>
                  </div>
                  <p {...stylex.props(syncSettingsStyles.statusDescription)}>
                    Google Drive is connected with account {session.user.email}. You are currently using your local-only library.
                  </p>
                  <div {...stylex.props(syncSettingsStyles.actionsRow)}>
                    <Button
                      label={`Switch to Account Library (${session.user.email})`}
                      variant="primary"
                      onClick={() => setSwitchingTarget(session.user.sub)}
                      data-testid="switch-to-account-library-button"
                    >
                      Switch to Account Library ({session.user.email})
                    </Button>
                    <Button
                      label="Disconnect"
                      variant="secondary"
                      onClick={handleDisconnect}
                      data-testid="disconnect-button"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div {...stylex.props(syncSettingsStyles.actionsRow)}>
                    <Button
                      label="Connect Google Drive"
                      variant="primary"
                      isLoading={isConnecting}
                      isDisabled={isConnecting}
                      onClick={() => setIsConfirmingConnect(true)}
                      data-testid="connect-drive-button"
                    >
                      Connect Google Drive
                    </Button>
                    <Button
                      label="Sync Now"
                      variant="secondary"
                      isLoading={isConnecting}
                      isDisabled={isConnecting}
                      onClick={() => setIsConfirmingConnect(true)}
                      tooltip="Connect Google Drive to synchronize"
                      data-testid="sync-now-button"
                    >
                      Sync Now
                    </Button>
                  </div>
                  <div {...stylex.props(syncSettingsStyles.unauthNote)}>
                    <p {...stylex.props(syncSettingsStyles.unauthParagraph)}>
                      Connecting Google Drive links your local library to your Google account for private cloud backup. If this account already has an existing library on this device, connecting will open your account library while keeping your local-only library intact and switchable at any time.
                    </p>
                    <p {...stylex.props(syncSettingsStyles.unauthNoteEmphasis)}>
                      Libraries are not automatically merged. All data remains stored locally on this device.
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : isConnectedAccountActive ? (
            <>
              <div {...stylex.props(syncSettingsStyles.profileRow)}>
                <div {...stylex.props(syncSettingsStyles.userInfo)}>
                  {session?.user.picture ? (
                    <img
                      src={session.user.picture}
                      alt={session.user.name}
                      {...stylex.props(syncSettingsStyles.avatar)}
                    />
                  ) : (
                    <div {...stylex.props(syncSettingsStyles.avatarFallback)}>
                      <User size={22} />
                    </div>
                  )}
                  <div {...stylex.props(syncSettingsStyles.userMeta)}>
                    <span {...stylex.props(syncSettingsStyles.userName)}>
                      {session?.user.name}
                    </span>
                    <span {...stylex.props(syncSettingsStyles.userEmail)}>
                      {session?.user.email}
                    </span>
                  </div>
                </div>

                {renderBadge()}
              </div>

              {hasVerifiedCollision && (
                <div {...stylex.props(syncSettingsStyles.noticeMessage)} data-testid="collision-notice">
                  <span>
                    {'Your prior local-only library remains separate on this device. Use the "Switch to Local-only Library" action below to open it at any time.'}
                  </span>
                </div>
              )}

              <p {...stylex.props(syncSettingsStyles.accountDescription)}>
                Connected account library. All data is stored locally on this device and works offline. Edits sync automatically with your personal Google Drive.
              </p>

              <div {...stylex.props(syncSettingsStyles.actionsRow)}>
                <Button
                  label="Sync Now"
                  variant="primary"
                  isLoading={syncState === 'syncing'}
                  isDisabled={syncState === 'syncing' || isPaused}
                  onClick={handleSyncNow}
                  data-testid="sync-now-button"
                >
                  Sync Now
                </Button>
                {isPaused ? (
                  <Button
                    label="Resume Sync"
                    variant="secondary"
                    onClick={async () => {
                      await resumeSync();
                    }}
                    data-testid="resume-sync-button"
                  >
                    Resume Sync
                  </Button>
                ) : (
                  <Button
                    label="Pause Sync"
                    variant="secondary"
                    onClick={async () => {
                      await pauseSync();
                    }}
                    data-testid="pause-sync-button"
                  >
                    Pause Sync
                  </Button>
                )}
                <Button
                  label="Disconnect"
                  variant="secondary"
                  onClick={handleDisconnect}
                  data-testid="disconnect-button"
                >
                  Disconnect
                </Button>
                <Button
                  label="Switch to Local-only Library"
                  variant="secondary"
                  onClick={() => setSwitchingTarget(ANONYMOUS_OWNER_SUB)}
                  data-testid="switch-to-local-library-button"
                >
                  Switch to Local-only Library
                </Button>
              </div>
            </>
          ) : (
            <div {...stylex.props(syncSettingsStyles.unauthContent)}>
              <div {...stylex.props(syncSettingsStyles.statusHeader)}>
                <div {...stylex.props(syncSettingsStyles.titleWithBadgeRow)}>
                  <span {...stylex.props(syncSettingsStyles.statusTitle)}>
                    Retained Account Library ({activeOwnerSub})
                  </span>
                  <span
                    {...stylex.props(syncSettingsStyles.badge, syncSettingsStyles.badgeStandby)}
                    data-status="standby"
                    data-testid="sync-status-badge"
                  >
                    <AlertCircle size={13} />
                    <span>Offline</span>
                  </span>
                </div>
                <p {...stylex.props(syncSettingsStyles.statusDescription)}>
                  {isAuthenticated
                    ? `Google Drive is connected with ${session?.user?.email ?? session?.user?.name}, but you are currently viewing your retained offline library (${activeOwnerSub}).`
                    : 'Google Drive is disconnected. Your local library remains open and available for offline reading and authoring. Reconnecting to your Google Account will resume cloud synchronization.'}
                </p>
              </div>
              <div {...stylex.props(syncSettingsStyles.actionsRow)}>
                {isAuthenticated && session ? (
                  <>
                    <Button
                      label={`Switch to Account Library (${session.user.email})`}
                      variant="primary"
                      onClick={() => setSwitchingTarget(session.user.sub)}
                      data-testid="switch-to-account-library-button"
                    >
                      Switch to Account Library ({session.user.email})
                    </Button>
                    <Button
                      label="Switch to Local-only Library"
                      variant="secondary"
                      onClick={() => setSwitchingTarget(ANONYMOUS_OWNER_SUB)}
                      data-testid="switch-to-local-library-button"
                    >
                      Switch to Local-only Library
                    </Button>
                    <Button
                      label="Disconnect"
                      variant="secondary"
                      onClick={handleDisconnect}
                      data-testid="disconnect-button"
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      label="Connect Google Drive"
                      variant="primary"
                      isLoading={isConnecting}
                      isDisabled={isConnecting}
                      onClick={() => setIsConfirmingConnect(true)}
                      data-testid="connect-drive-button"
                    >
                      Connect Google Drive
                    </Button>
                    <Button
                      label="Switch to Local-only Library"
                      variant="secondary"
                      onClick={() => setSwitchingTarget(ANONYMOUS_OWNER_SUB)}
                      data-testid="switch-to-local-library-button"
                    >
                      Switch to Local-only Library
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {isConfirmingConnect && (
            <ConfirmationDialog
              isOpen={true}
              title="Connect Google Drive"
              message="Connecting Google Drive links your local library to your Google account for private cloud backup. If this account already has an existing library on this device, it will open your account library while keeping your local-only library intact and switchable. Libraries are not merged. Please save any unsaved work in the editor before proceeding."
              confirmLabel="Connect Google Drive"
              cancelLabel="Cancel"
              intent="warning"
              onConfirm={async () => {
                setIsConfirmingConnect(false);
                await handleExecuteConnect();
              }}
              onCancel={() => setIsConfirmingConnect(false)}
            />
          )}

          {switchingTarget !== null && (
            <ConfirmationDialog
              isOpen={true}
              title="Switch Active Library?"
              message="Switching libraries changes the active local database. Any unsaved drafts in the editor will be discarded."
              confirmLabel="Confirm Switch"
              cancelLabel="Cancel"
              intent="warning"
              onConfirm={async () => {
                const target = switchingTarget;
                setSwitchingTarget(null);
                if (context?.switchActiveLibrary && target) {
                  await context.switchActiveLibrary(target);
                }
              }}
              onCancel={() => setSwitchingTarget(null)}
            />
          )}
        </div>
      </Card>

      <h3 {...stylex.props(syncSettingsStyles.subheading)} id="settings-selective-sync-heading">
        Selective Sync
      </h3>
      <p {...stylex.props(syncSettingsStyles.subdescription)}>
        Choose which data categories synchronize with your cloud storage. Disabling a category keeps that data strictly local to this device and emits zero deletion tombstones to peer devices.
      </p>

      <Card>
        <div {...stylex.props(syncSettingsStyles.selectiveSyncCard)}>
          <div {...stylex.props(syncSettingsStyles.switchRow)}>
            <Switch
              label="Annotations"
              description="Highlights & Drawings"
              value={preferences.annotations}
              onChange={(checked) => handleToggleCategory('annotations', checked)}
              labelPosition="start"
              labelSpacing="spread"
              width="100%"
              aria-label="Annotations"
            />
          </div>
          <div {...stylex.props(syncSettingsStyles.divider)} />
          <div {...stylex.props(syncSettingsStyles.switchRow)}>
            <Switch
              label="Spaced Repetition"
              description="Flashcard Review History"
              value={preferences.flashcards}
              onChange={(checked) => handleToggleCategory('flashcards', checked)}
              labelPosition="start"
              labelSpacing="spread"
              width="100%"
              aria-label="Spaced Repetition"
            />
          </div>
          <div {...stylex.props(syncSettingsStyles.divider)} />
          <div {...stylex.props(syncSettingsStyles.switchRow)}>
            <Switch
              label="Quiz History & Scores"
              description="Quiz sessions, attempts, and historical scores"
              value={preferences.quizHistory}
              onChange={(checked) => handleToggleCategory('quizHistory', checked)}
              labelPosition="start"
              labelSpacing="spread"
              width="100%"
              aria-label="Quiz History & Scores"
            />
          </div>
          <div {...stylex.props(syncSettingsStyles.divider)} />
          <div {...stylex.props(syncSettingsStyles.switchRow)}>
            <Switch
              label="Custom Materials"
              description="Custom materials, questions, quizzes, and authored notes"
              value={preferences.customMaterials}
              onChange={(checked) => handleToggleCategory('customMaterials', checked)}
              labelPosition="start"
              labelSpacing="spread"
              width="100%"
              aria-label="Custom Materials"
            />
          </div>
        </div>
      </Card>
    </section>
  );
}

export default SyncSettingsSection;
