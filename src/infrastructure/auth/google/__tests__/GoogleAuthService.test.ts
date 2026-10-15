import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GoogleAuthService,
  DEFAULT_GOOGLE_SCOPES,
  type AuthStorage,
  type GoogleAuthServiceOptions,
} from '../GoogleAuthService';
import type {
  GoogleGlobal,
  GisCodeClientConfig,
  GisCodeResponse,
  GisErrorResponse,
} from '../loadGis';
import type { GoogleAuthSession } from '../../../../domain/auth/models/auth.types';
import type { VaultRegistryPort } from '../../../../domain/vault/models/vault.types';

function createInMemoryStorage(): AuthStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  };
}

describe('Infrastructure: GoogleAuthService', () => {
  let inMemoryStorage: AuthStorage;
  let mockInitCodeClient: ReturnType<typeof vi.fn>;
  let mockRevoke: ReturnType<typeof vi.fn>;
  let mockLoadGis: ReturnType<typeof vi.fn>;
  let mockVaultRegistry: VaultRegistryPort;
  let capturedConfig: GisCodeClientConfig | null;

  function createService(options: Partial<GoogleAuthServiceOptions> = {}): GoogleAuthService {
    return new GoogleAuthService({
      clientId: 'test-client-id',
      storage: inMemoryStorage,
      loadGis: mockLoadGis as unknown as (url?: string) => Promise<GoogleGlobal>,
      vaultRegistry: mockVaultRegistry,
      ...options,
    });
  }

  beforeEach(() => {
    inMemoryStorage = createInMemoryStorage();
    capturedConfig = null;

    mockVaultRegistry = {
      getActiveVault: vi.fn(),
      promoteAnonymousVault: vi.fn(async (sub: string) => ({
        pointer: {
          ownerSub: sub,
          physicalDbName: 'lc_vault_mock123',
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        },
      })),
      listVaults: vi.fn(),
      switchActiveVault: vi.fn(),
      deleteVault: vi.fn(),
    };

    mockInitCodeClient = vi.fn((config: GisCodeClientConfig) => {
      capturedConfig = config;
      return {
        requestCode: vi.fn(),
      };
    });

    mockRevoke = vi.fn();

    const mockGoogle = {
      accounts: {
        oauth2: {
          initCodeClient: mockInitCodeClient,
          revoke: mockRevoke,
        },
      },
    } as unknown as GoogleGlobal;

    mockLoadGis = vi.fn(async () => mockGoogle);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with unauthenticated status when storage is empty', () => {
    const service = createService({
      clientId: 'test-client-id.apps.googleusercontent.com',
    });

    expect(service.getSession()).toBeNull();
    expect(service.getStatus()).toBe('unauthenticated');
  });

  it('rehydrates valid session from storage on instantiation', () => {
    const storedSession: GoogleAuthSession = {
      user: {
        sub: 'sub-existing',
        email: 'user@example.com',
        name: 'Existing User',
      },
      tokens: {
        accessToken: 'stored-access-token',
        expiresAt: Date.now() + 3600000,
        sealedRefreshToken: 'sealed.blob.123',
      },
    };
    inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(storedSession));

    const service = createService();

    expect(service.getSession()).toEqual(storedSession);
    expect(service.getStatus()).toBe('authenticated');
  });

  it('throws error during login if clientId is missing', async () => {
    const service = createService({ clientId: '' });

    await expect(service.login()).rejects.toThrow(/Missing Google Client ID/);
    expect(service.getStatus()).toBe('unauthenticated');
  });

  it('completes login flow, exchanges code, and saves session', async () => {
    const mockTokenExchangeResponse = {
      accessToken: 'ya29.new-token',
      expiresIn: 3600,
      sub: 'google-sub-777',
      email: 'test@lunaclair.dev',
      name: 'Luna Test',
      picture: 'https://avatar.png',
      sealedRefreshToken: 'sealed.refresh.token',
    };

    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/auth/google/token')) {
        return new Response(JSON.stringify(mockTokenExchangeResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not found', { status: 404 });
    });

    const service = createService({
      customFetch: mockFetch as unknown as typeof fetch,
    });

    const sessionListener = vi.fn();
    service.subscribe(sessionListener);

    const loginPromise = service.login();

    // Verify GIS code client initialization options
    await vi.waitFor(() => {
      expect(mockInitCodeClient).toHaveBeenCalledTimes(1);
    });
    expect(capturedConfig?.client_id).toBe('test-client-id');
    expect(capturedConfig?.scope).toBe(DEFAULT_GOOGLE_SCOPES);
    expect(capturedConfig?.redirect_uri).toBe('postmessage');

    // Simulate GIS popup returning auth code
    const mockCodeResponse: GisCodeResponse = {
      code: 'auth-code-12345',
    };
    capturedConfig?.callback?.(mockCodeResponse);

    const session = await loginPromise;

    expect(session.user.sub).toBe('google-sub-777');
    expect(session.user.email).toBe('test@lunaclair.dev');
    expect(session.tokens.accessToken).toBe('ya29.new-token');
    expect(session.tokens.sealedRefreshToken).toBe('sealed.refresh.token');
    expect(session.tokens.expiresAt).toBeGreaterThan(Date.now());

    expect(service.getStatus()).toBe('authenticated');
    expect(sessionListener).toHaveBeenCalledWith(session);

    // Verify storage persistence
    const savedRaw = inMemoryStorage.getItem('lunaclair.auth.google_session');
    expect(savedRaw).not.toBeNull();
    const parsed = JSON.parse(savedRaw!);
    expect(parsed.user.sub).toBe('google-sub-777');

    // Verify vault promotion
    expect(mockVaultRegistry.promoteAnonymousVault).toHaveBeenCalledWith('google-sub-777');
    expect(service.getLastPromotionResult()?.pointer.ownerSub).toBe('google-sub-777');
  });

  it('handles vault collision on login gracefully', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockVaultRegistry.promoteAnonymousVault = vi.fn(async (sub: string) => ({
      pointer: {
        ownerSub: sub,
        physicalDbName: 'lc_vault_existing_db',
        createdAt: 1000,
        lastActiveAt: 2000,
      },
      collisionFromAnonDb: 'lc_vault_anon_db',
    }));

    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          accessToken: 'ya29.token',
          expiresIn: 3600,
          sub: 'collision-user-sub',
          email: 'collision@lunaclair.dev',
          name: 'Collision User',
          sealedRefreshToken: 'sealed.token',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const service = createService({
      customFetch: mockFetch as unknown as typeof fetch,
    });

    const loginPromise = service.login();
    await vi.waitFor(() => expect(mockInitCodeClient).toHaveBeenCalledTimes(1));
    capturedConfig?.callback?.({ code: 'collision-code' });

    const session = await loginPromise;
    expect(session.user.sub).toBe('collision-user-sub');
    expect(mockVaultRegistry.promoteAnonymousVault).toHaveBeenCalledWith('collision-user-sub');
    expect(service.getLastPromotionResult()?.collisionFromAnonDb).toBe('lc_vault_anon_db');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Vault collision detected'),
    );
    consoleWarnSpy.mockRestore();
  });

  it('proceeds with login even if vault promotion throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockVaultRegistry.promoteAnonymousVault = vi.fn(async () => {
      throw new Error('Database locked');
    });

    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          accessToken: 'ya29.token',
          expiresIn: 3600,
          sub: 'robust-user-sub',
          email: 'robust@lunaclair.dev',
          name: 'Robust User',
          sealedRefreshToken: 'sealed.token',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const service = createService({
      customFetch: mockFetch as unknown as typeof fetch,
    });

    const loginPromise = service.login();
    await vi.waitFor(() => expect(mockInitCodeClient).toHaveBeenCalledTimes(1));
    capturedConfig?.callback?.({ code: 'robust-code' });

    const session = await loginPromise;
    expect(session.user.sub).toBe('robust-user-sub');
    expect(service.getStatus()).toBe('authenticated');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to promote vault during login'),
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });

  it('propagates error when GIS error_callback fires (e.g. popup closed)', async () => {
    const service = createService();

    const loginPromise = service.login();

    await vi.waitFor(() => {
      expect(mockInitCodeClient).toHaveBeenCalledTimes(1);
    });

    const errorResponse: GisErrorResponse = {
      type: 'popup_closed',
      message: 'User closed the authorization window',
    };
    capturedConfig?.error_callback?.(errorResponse);

    await expect(loginPromise).rejects.toThrow('User closed the authorization window');
    expect(service.getStatus()).toBe('unauthenticated');
  });

  it('propagates error when token exchange endpoint fails', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: 'invalid_grant', message: 'Code has expired' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const service = createService({
      customFetch: mockFetch as unknown as typeof fetch,
    });

    const loginPromise = service.login();

    await vi.waitFor(() => {
      expect(mockInitCodeClient).toHaveBeenCalledTimes(1);
    });

    capturedConfig?.callback?.({ code: 'expired-code' });

    await expect(loginPromise).rejects.toThrow('Code has expired');
    expect(service.getStatus()).toBe('unauthenticated');
  });

  it('returns valid access token directly when not expiring soon', async () => {
    const validSession: GoogleAuthSession = {
      user: { sub: 'sub-1', email: 'test@example.com', name: 'Test' },
      tokens: {
        accessToken: 'current-valid-token',
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes from now
        sealedRefreshToken: 'sealed-token',
      },
    };
    inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(validSession));

    const mockFetch = vi.fn();
    const service = createService({
      customFetch: mockFetch as unknown as typeof fetch,
    });

    const token = await service.getValidAccessToken();
    expect(token).toBe('current-valid-token');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('silently refreshes token when expiring within 2 minutes', async () => {
    const expiringSession: GoogleAuthSession = {
      user: { sub: 'sub-expiring', email: 'exp@example.com', name: 'Expiring User' },
      tokens: {
        accessToken: 'old-access-token',
        expiresAt: Date.now() + 60 * 1000, // 1 minute left (< 2 min threshold)
        sealedRefreshToken: 'sealed-refresh-token-data',
      },
    };
    inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(expiringSession));

    const mockRefreshResponse = {
      accessToken: 'refreshed-access-token',
      expiresIn: 3600,
    };

    let refreshBodySent: unknown = null;
    const mockFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      refreshBodySent = JSON.parse(init?.body as string);
      return new Response(JSON.stringify(mockRefreshResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const service = createService({
      customFetch: mockFetch as unknown as typeof fetch,
    });

    const listener = vi.fn();
    service.subscribe(listener);

    const token = await service.getValidAccessToken();

    expect(token).toBe('refreshed-access-token');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(refreshBodySent).toEqual({
      sub: 'sub-expiring',
      sealedRefreshToken: 'sealed-refresh-token-data',
      clientId: 'test-client-id',
    });

    const updatedSession = service.getSession();
    expect(updatedSession?.tokens.accessToken).toBe('refreshed-access-token');
    expect(updatedSession?.tokens.expiresAt).toBeGreaterThan(Date.now() + 3000 * 1000);
    expect(listener).toHaveBeenCalledWith(updatedSession);
  });

  it('deduplicates concurrent getValidAccessToken calls during refresh', async () => {
    const expiringSession: GoogleAuthSession = {
      user: { sub: 'sub-dedup', email: 'dedup@example.com', name: 'Dedup' },
      tokens: {
        accessToken: 'old-token',
        expiresAt: Date.now() - 1000, // already expired
        sealedRefreshToken: 'sealed-token',
      },
    };
    inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(expiringSession));

    const mockFetch = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify({ accessToken: 'new-shared-token', expiresIn: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const service = createService({
      customFetch: mockFetch as unknown as typeof fetch,
    });

    const [t1, t2, t3] = await Promise.all([
      service.getValidAccessToken(),
      service.getValidAccessToken(),
      service.getValidAccessToken(),
    ]);

    expect(t1).toBe('new-shared-token');
    expect(t2).toBe('new-shared-token');
    expect(t3).toBe('new-shared-token');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('clears session and logs out when refresh fails with 401 invalid_grant', async () => {
    const expiringSession: GoogleAuthSession = {
      user: { sub: 'sub-revoked', email: 'revoked@example.com', name: 'Revoked User' },
      tokens: {
        accessToken: 'stale-token',
        expiresAt: Date.now() - 1000,
        sealedRefreshToken: 'revoked-sealed-token',
      },
    };
    inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(expiringSession));

    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: 'invalid_grant', message: 'Token has been expired or revoked' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const service = createService({
      customFetch: mockFetch as unknown as typeof fetch,
    });

    const listener = vi.fn();
    service.subscribe(listener);

    await expect(service.getValidAccessToken()).rejects.toThrow(
      'Authentication expired: Token has been expired or revoked',
    );

    expect(service.getSession()).toBeNull();
    expect(service.getStatus()).toBe('unauthenticated');
    expect(inMemoryStorage.getItem('lunaclair.auth.google_session')).toBeNull();
    expect(listener).toHaveBeenCalledWith(null);
  });

  it('gracefully returns existing token if refresh fails due to network error and token not fully expired', async () => {
    const nearExpirySession: GoogleAuthSession = {
      user: { sub: 'sub-network', email: 'net@example.com', name: 'Net' },
      tokens: {
        accessToken: 'still-valid-token',
        expiresAt: Date.now() + 30 * 1000, // 30s remaining
        sealedRefreshToken: 'sealed-token',
      },
    };
    inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(nearExpirySession));

    const mockFetch = vi.fn(async () => {
      throw new Error('Network connection offline');
    });

    const service = createService({
      customFetch: mockFetch as unknown as typeof fetch,
    });

    const token = await service.getValidAccessToken();
    expect(token).toBe('still-valid-token');
  });

  it('clears session, notifies listeners, and attempts token revocation on logout', async () => {
    const activeSession: GoogleAuthSession = {
      user: { sub: 'sub-active', email: 'logout@example.com', name: 'Logout User' },
      tokens: {
        accessToken: 'active-access-token',
        expiresAt: Date.now() + 3600000,
        sealedRefreshToken: 'active-sealed-token',
      },
    };
    inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(activeSession));

    window.google = {
      accounts: {
        oauth2: {
          initCodeClient: mockInitCodeClient as unknown as (config: GisCodeClientConfig) => { requestCode(): void },
          revoke: mockRevoke as unknown as (token: string) => void,
        },
      },
    };

    const service = createService();

    const listener = vi.fn();
    service.subscribe(listener);

    await service.logout();

    expect(service.getSession()).toBeNull();
    expect(service.getStatus()).toBe('unauthenticated');
    expect(inMemoryStorage.getItem('lunaclair.auth.google_session')).toBeNull();
    expect(listener).toHaveBeenCalledWith(null);
    expect(mockRevoke).toHaveBeenCalledWith('active-access-token');
  });
});
