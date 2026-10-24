import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { bootstrapApplication, resetBootstrapForTesting } from '../bootstrap';
import { googleAuthService } from '../../infrastructure/auth/google/GoogleAuthService';
import { vaultRegistry } from '../../infrastructure/database/registry/VaultRegistry';
import { DatabaseInitializer } from '../../infrastructure/database/schema/DatabaseInitializer';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';

describe('bootstrapApplication cold start resolution', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEYS.vault.activeOwnerSub);
    resetBootstrapForTesting();
    DatabaseInitializer.resetForTesting();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEYS.vault.activeOwnerSub);
    resetBootstrapForTesting();
    DatabaseInitializer.resetForTesting();
    vi.restoreAllMocks();
  });

  it('resolves active vault using session user sub when preferredSub not specified', async () => {
    vi.spyOn(googleAuthService, 'getSession').mockReturnValue({
      user: { sub: 'google-sub-999', email: 'test@example.com', name: 'Tester' },
      tokens: { accessToken: 'token', expiresAt: Date.now() + 60000, sealedRefreshToken: 'sealed' },
    });

    const getActiveVaultSpy = vi.spyOn(vaultRegistry, 'getActiveVault').mockResolvedValue({
      ownerSub: 'google-sub-999',
      physicalDbName: 'lc_vault_test_999',
      createdAt: 1000,
      lastActiveAt: 1000,
    });

    vi.spyOn(DatabaseInitializer, 'initialize').mockResolvedValue(undefined);

    await bootstrapApplication();

    expect(getActiveVaultSpy).toHaveBeenCalledWith('google-sub-999');
  });

  it('resolves active vault using explicit preferredSub over session', async () => {
    vi.spyOn(googleAuthService, 'getSession').mockReturnValue({
      user: { sub: 'session-sub', email: 'test@example.com', name: 'Tester' },
      tokens: { accessToken: 'token', expiresAt: Date.now() + 60000, sealedRefreshToken: 'sealed' },
    });

    const getActiveVaultSpy = vi.spyOn(vaultRegistry, 'getActiveVault').mockResolvedValue({
      ownerSub: 'explicit-sub',
      physicalDbName: 'lc_vault_explicit',
      createdAt: 1000,
      lastActiveAt: 1000,
    });

    vi.spyOn(DatabaseInitializer, 'initialize').mockResolvedValue(undefined);

    await bootstrapApplication('explicit-sub');

    expect(getActiveVaultSpy).toHaveBeenCalledWith('explicit-sub');
  });

  it('resolves active vault with undefined when unauthenticated and no preferredSub', async () => {
    vi.spyOn(googleAuthService, 'getSession').mockReturnValue(null);

    const getActiveVaultSpy = vi.spyOn(vaultRegistry, 'getActiveVault').mockResolvedValue({
      ownerSub: 'ANONYMOUS',
      physicalDbName: 'lc_vault_anon',
      createdAt: 1000,
      lastActiveAt: 1000,
    });

    vi.spyOn(DatabaseInitializer, 'initialize').mockResolvedValue(undefined);

    await bootstrapApplication();

    expect(getActiveVaultSpy).toHaveBeenCalledWith(undefined);
  });
});
