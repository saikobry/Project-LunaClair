import { useState, useContext, useCallback, useSyncExternalStore } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  CheckCircle2,
  RefreshCw,
  PauseCircle,
  AlertCircle,
  User,
} from 'lucide-react';
import { Card } from '../../../shared/ui/Card/Card';
import { Button } from '../../../shared/ui/Button/Button';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import type {
  GoogleAuthPort,
  GoogleAuthSession,
  AuthStatus,
} from '../../../domain/auth/models/auth.types';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { syncSettingsStyles } from './syncSettings.stylex';

export interface SyncSettingsSectionProps {
  authService?: GoogleAuthPort;
}

export type SyncBadgeStatus = 'synced' | 'syncing' | 'standby' | 'error';

/**
 * Settings section for Google Drive Bring-Your-Own-Storage (BYOS) cloud sync.
 * Governed by ADR-018.
 */
export function SyncSettingsSection({ authService: propAuthService }: SyncSettingsSectionProps) {
  const context = useContext(ApplicationContext);
  const auth = propAuthService ?? context?.infrastructure?.providers?.auth;

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

  const { state: syncState, triggerSync } = useSyncStatus();

  const handleConnect = useCallback(async () => {
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

  const computeBadgeStatus = (): SyncBadgeStatus => {
    if (authStatus === 'standby' || syncState === 'standby') return 'standby';
    if (syncState === 'syncing') return 'syncing';
    if (syncState === 'error') return 'error';
    return 'synced';
  };

  const badgeStatus = computeBadgeStatus();

  const renderBadge = () => {
    switch (badgeStatus) {
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

          {!isAuthenticated ? (
            <div {...stylex.props(syncSettingsStyles.unauthContent)}>
              <Button
                label="Connect Google Drive"
                variant="primary"
                isLoading={isConnecting}
                isDisabled={isConnecting}
                onClick={handleConnect}
              >
                Connect Google Drive
              </Button>
            </div>
          ) : (
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

              <div {...stylex.props(syncSettingsStyles.actionsRow)}>
                <Button
                  label="Sync Now"
                  variant="primary"
                  isLoading={syncState === 'syncing'}
                  isDisabled={syncState === 'syncing'}
                  onClick={handleSyncNow}
                >
                  Sync Now
                </Button>
                <Button
                  label="Disconnect"
                  variant="secondary"
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </section>
  );
}

export default SyncSettingsSection;
