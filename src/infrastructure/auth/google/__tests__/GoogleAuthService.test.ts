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
import * as dbSchema from '../../../database/schema/LunaClairDatabase';

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

  it('rejects and does not authenticate when vault promotion throws', async () => {
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

    await expect(loginPromise).rejects.toThrow('Database locked');
    expect(service.getStatus()).toBe('unauthenticated');
    expect(service.getSession()).toBeNull();
    expect(inMemoryStorage.getItem('lunaclair.auth.google_session')).toBeNull();
    expect(service.getLastPromotionResult()).toBeNull();
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

  describe('Session Generation & Stale Operation Isolation', () => {
    it('tracks monotonically increasing session generation counter', async () => {
      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/auth/google/token')) {
          return new Response(
            JSON.stringify({
              accessToken: 'ya29.epoch-token',
              expiresIn: 3600,
              sub: 'epoch-user-sub',
              email: 'epoch@lunaclair.dev',
              name: 'Epoch User',
              sealedRefreshToken: 'sealed.epoch.token',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (urlStr.includes('/api/auth/google/refresh')) {
          return new Response(
            JSON.stringify({
              accessToken: 'ya29.epoch-refreshed',
              expiresIn: 3600,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('Not found', { status: 404 });
      });

      const service = createService({
        customFetch: mockFetch as unknown as typeof fetch,
      });

      // Initial unauthenticated generation
      expect(service.getSessionGeneration()).toBe(0);

      // Logout increments generation
      await service.logout();
      expect(service.getSessionGeneration()).toBe(1);

      // Login increments generation
      const loginPromise = service.login();
      await vi.waitFor(() => expect(mockInitCodeClient).toHaveBeenCalledTimes(1));
      capturedConfig?.callback?.({ code: 'epoch-auth-code' });
      await loginPromise;
      expect(service.getSessionGeneration()).toBe(2);

      // Silent token refresh does NOT increment epoch generation
      const refreshedToken = await service.refreshAccessToken();
      expect(refreshedToken).toBe('ya29.epoch-refreshed');
      expect(service.getSessionGeneration()).toBe(2);

      // Subsequent logout increments generation
      await service.logout();
      expect(service.getSessionGeneration()).toBe(3);
    });

    it('pending A refresh -> logout -> old refresh success throws explicit abort error and does not return tokens or resurrect session', async () => {
      const sessionA: GoogleAuthSession = {
        user: { sub: 'sub-user-a', email: 'a@example.com', name: 'User A' },
        tokens: {
          accessToken: 'token-a-old',
          expiresAt: Date.now() - 1000,
          sealedRefreshToken: 'sealed-token-a',
        },
      };
      inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(sessionA));

      let resolveRefreshA: (res: Response) => void;
      const refreshFetchPromise = new Promise<Response>((resolve) => {
        resolveRefreshA = resolve;
      });

      const mockFetch = vi.fn(async () => refreshFetchPromise);

      const service = createService({
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const listener = vi.fn();
      service.subscribe(listener);

      // User A initiates refresh
      const refreshPromise = service.getValidAccessToken();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // User logs out while refresh is in flight
      await service.logout();
      expect(service.getSession()).toBeNull();
      expect(service.getStatus()).toBe('unauthenticated');
      expect(listener).toHaveBeenCalledWith(null);
      listener.mockClear();

      // Old refresh finishes successfully
      resolveRefreshA!(
        new Response(
          JSON.stringify({
            accessToken: 'token-a-refreshed',
            expiresIn: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      // Old success must throw explicit abort error and not return token
      await expect(refreshPromise).rejects.toThrow(
        'Token refresh aborted: session identity changed during refresh',
      );

      // Crucial: Must NOT resurrect session
      expect(service.getSession()).toBeNull();
      expect(service.getStatus()).toBe('unauthenticated');
      expect(inMemoryStorage.getItem('lunaclair.auth.google_session')).toBeNull();
      expect(listener).not.toHaveBeenCalled();
    });

    it('pending A refresh -> logout -> User B login -> old A refresh success does not overwrite User B session or tokens', async () => {
      const sessionA: GoogleAuthSession = {
        user: { sub: 'sub-user-a', email: 'a@example.com', name: 'User A' },
        tokens: {
          accessToken: 'token-a-old',
          expiresAt: Date.now() - 1000,
          sealedRefreshToken: 'sealed-token-a',
        },
      };
      inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(sessionA));

      let resolveRefreshA: (res: Response) => void;
      const refreshFetchPromiseA = new Promise<Response>((resolve) => {
        resolveRefreshA = resolve;
      });

      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/auth/google/refresh')) {
          return refreshFetchPromiseA;
        }
        if (urlStr.includes('/api/auth/google/token')) {
          return new Response(
            JSON.stringify({
              accessToken: 'token-b-active',
              expiresIn: 3600,
              sub: 'sub-user-b',
              email: 'b@example.com',
              name: 'User B',
              sealedRefreshToken: 'sealed-token-b',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('Not found', { status: 404 });
      });

      const service = createService({
        customFetch: mockFetch as unknown as typeof fetch,
      });

      // User A initiates refresh
      const refreshPromiseA = service.getValidAccessToken();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // User A logs out
      await service.logout();

      // User B logs in
      const loginPromiseB = service.login();
      await vi.waitFor(() => expect(mockInitCodeClient).toHaveBeenCalledTimes(1));
      capturedConfig?.callback?.({ code: 'user-b-auth-code' });
      const sessionB = await loginPromiseB;

      expect(service.getStatus()).toBe('authenticated');
      expect(sessionB.user.sub).toBe('sub-user-b');
      expect(service.getSession()?.tokens.accessToken).toBe('token-b-active');

      const listener = vi.fn();
      service.subscribe(listener);

      // User A's delayed refresh response finally arrives
      resolveRefreshA!(
        new Response(
          JSON.stringify({
            accessToken: 'token-a-stale-refreshed',
            expiresIn: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(refreshPromiseA).rejects.toThrow(
        'Token refresh aborted: session identity changed during refresh',
      );

      // User B's session and tokens MUST remain intact
      expect(service.getStatus()).toBe('authenticated');
      expect(service.getSession()?.user.sub).toBe('sub-user-b');
      expect(service.getSession()?.tokens.accessToken).toBe('token-b-active');
      expect(listener).not.toHaveBeenCalled();

      const storedSession = JSON.parse(
        inMemoryStorage.getItem('lunaclair.auth.google_session')!,
      ) as GoogleAuthSession;
      expect(storedSession.user.sub).toBe('sub-user-b');
      expect(storedSession.tokens.accessToken).toBe('token-b-active');
    });

    it('pending A refresh -> logout -> User B login -> old A 401 failure does not log User B out', async () => {
      const sessionA: GoogleAuthSession = {
        user: { sub: 'sub-user-a', email: 'a@example.com', name: 'User A' },
        tokens: {
          accessToken: 'token-a-old',
          expiresAt: Date.now() - 1000,
          sealedRefreshToken: 'sealed-token-a',
        },
      };
      inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(sessionA));

      let resolveRefreshA: (res: Response) => void;
      const refreshFetchPromiseA = new Promise<Response>((resolve) => {
        resolveRefreshA = resolve;
      });

      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/auth/google/refresh')) {
          return refreshFetchPromiseA;
        }
        if (urlStr.includes('/api/auth/google/token')) {
          return new Response(
            JSON.stringify({
              accessToken: 'token-b-active',
              expiresIn: 3600,
              sub: 'sub-user-b',
              email: 'b@example.com',
              name: 'User B',
              sealedRefreshToken: 'sealed-token-b',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('Not found', { status: 404 });
      });

      const service = createService({
        customFetch: mockFetch as unknown as typeof fetch,
      });

      // User A initiates refresh
      const refreshPromiseA = service.getValidAccessToken();

      // User A logs out
      await service.logout();

      // User B logs in
      const loginPromiseB = service.login();
      await vi.waitFor(() => expect(mockInitCodeClient).toHaveBeenCalledTimes(1));
      capturedConfig?.callback?.({ code: 'user-b-auth-code' });
      await loginPromiseB;

      expect(service.getStatus()).toBe('authenticated');
      expect(service.getSession()?.user.sub).toBe('sub-user-b');

      // User A's refresh fails with 401 invalid_grant
      resolveRefreshA!(
        new Response(
          JSON.stringify({
            error: 'invalid_grant',
            message: 'Token expired or revoked',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      // User A's refresh promise rejects
      await expect(refreshPromiseA).rejects.toThrow(/Authentication expired/);

      // User B MUST NOT be logged out!
      expect(service.getStatus()).toBe('authenticated');
      expect(service.getSession()?.user.sub).toBe('sub-user-b');
      expect(service.getSession()?.tokens.accessToken).toBe('token-b-active');
      expect(inMemoryStorage.getItem('lunaclair.auth.google_session')).toContain('sub-user-b');
    });

    it('User B calling getValidAccessToken() does not join User A in-flight refresh', async () => {
      const sessionA: GoogleAuthSession = {
        user: { sub: 'sub-user-a', email: 'a@example.com', name: 'User A' },
        tokens: {
          accessToken: 'token-a-old',
          expiresAt: Date.now() - 1000,
          sealedRefreshToken: 'sealed-token-a',
        },
      };
      inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(sessionA));

      let resolveRefreshA: (res: Response) => void;
      let resolveRefreshB: (res: Response) => void;
      const fetchA = new Promise<Response>((resolve) => {
        resolveRefreshA = resolve;
      });
      const fetchB = new Promise<Response>((resolve) => {
        resolveRefreshB = resolve;
      });

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/auth/google/refresh')) {
          const body = JSON.parse(init?.body as string);
          if (body.sub === 'sub-user-a') {
            return fetchA;
          }
          if (body.sub === 'sub-user-b') {
            return fetchB;
          }
        }
        if (urlStr.includes('/api/auth/google/token')) {
          return new Response(
            JSON.stringify({
              accessToken: 'token-b-initial',
              expiresIn: 3600,
              sub: 'sub-user-b',
              email: 'b@example.com',
              name: 'User B',
              sealedRefreshToken: 'sealed-token-b',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('Not found', { status: 404 });
      });

      const service = createService({
        customFetch: mockFetch as unknown as typeof fetch,
      });

      // User A initiates refresh
      const refreshPromiseA = service.getValidAccessToken();

      // User A logs out
      await service.logout();

      // User B logs in
      const loginPromiseB = service.login();
      await vi.waitFor(() => expect(mockInitCodeClient).toHaveBeenCalledTimes(1));
      capturedConfig?.callback?.({ code: 'b-code' });
      await loginPromiseB;

      // User B forces token refresh
      const refreshPromiseB = service.getValidAccessToken(true);

      // Verify that User B did NOT join User A's in-flight refresh (2 refresh calls dispatched)
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1: refresh A, 2: token exchange B, 3: refresh B

      // Resolve User B's refresh first
      resolveRefreshB!(
        new Response(
          JSON.stringify({
            accessToken: 'token-b-refreshed',
            expiresIn: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const tokenB = await refreshPromiseB;
      expect(tokenB).toBe('token-b-refreshed');
      expect(service.getSession()?.tokens.accessToken).toBe('token-b-refreshed');

      // Now resolve User A's refresh
      resolveRefreshA!(
        new Response(
          JSON.stringify({
            accessToken: 'token-a-refreshed',
            expiresIn: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(refreshPromiseA).rejects.toThrow(
        'Token refresh aborted: session identity changed during refresh',
      );

      // User B's session remains untouched
      expect(service.getSession()?.user.sub).toBe('sub-user-b');
      expect(service.getSession()?.tokens.accessToken).toBe('token-b-refreshed');
    });

    it('pending login flow -> logout called before login completes -> does not set authenticated status (GIS callback)', async () => {
      const service = createService();

      const loginPromise = service.login();
      await vi.waitFor(() => {
        expect(mockInitCodeClient).toHaveBeenCalledTimes(1);
      });

      // User cancels / logs out while GIS popup is pending
      await service.logout();
      expect(service.getStatus()).toBe('unauthenticated');

      // GIS popup completes late with authorization code
      capturedConfig?.callback?.({ code: 'late-auth-code' });

      await expect(loginPromise).rejects.toThrow(/Login cancelled: session logged out/);
      expect(service.getStatus()).toBe('unauthenticated');
      expect(service.getSession()).toBeNull();
      expect(inMemoryStorage.getItem('lunaclair.auth.google_session')).toBeNull();
    });

    it('pending login flow -> logout called while token exchange fetch is in flight -> does not set authenticated status', async () => {
      let resolveTokenFetch: (res: Response) => void;
      const tokenFetchPromise = new Promise<Response>((resolve) => {
        resolveTokenFetch = resolve;
      });

      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/auth/google/token')) {
          return tokenFetchPromise;
        }
        return new Response('Not found', { status: 404 });
      });

      const service = createService({
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const loginPromise = service.login();
      await vi.waitFor(() => expect(mockInitCodeClient).toHaveBeenCalledTimes(1));

      // GIS callback fires, starting token exchange fetch
      capturedConfig?.callback?.({ code: 'exchange-code-123' });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Logout called while exchange fetch is in flight
      await service.logout();
      expect(service.getStatus()).toBe('unauthenticated');

      // Token exchange fetch resolves
      resolveTokenFetch!(
        new Response(
          JSON.stringify({
            accessToken: 'late-access-token',
            expiresIn: 3600,
            sub: 'late-user-sub',
            email: 'late@lunaclair.dev',
            name: 'Late User',
            sealedRefreshToken: 'late-sealed-token',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(loginPromise).rejects.toThrow(/Login cancelled: session logged out/);
      expect(service.getStatus()).toBe('unauthenticated');
      expect(service.getSession()).toBeNull();
      expect(inMemoryStorage.getItem('lunaclair.auth.google_session')).toBeNull();
      expect(mockVaultRegistry.promoteAnonymousVault).not.toHaveBeenCalled();
    });

    it('network error during refresh does not return expired token if session changed', async () => {
      const expiringSession: GoogleAuthSession = {
        user: { sub: 'sub-net-stale', email: 'net@example.com', name: 'Net Stale' },
        tokens: {
          accessToken: 'old-access-token',
          expiresAt: Date.now() + 30 * 1000, // 30s remaining
          sealedRefreshToken: 'sealed-token',
        },
      };
      inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(expiringSession));

      let rejectFetch: (err: Error) => void;
      const fetchPromise = new Promise<Response>((_, reject) => {
        rejectFetch = reject;
      });

      const mockFetch = vi.fn(async () => fetchPromise);

      const service = createService({
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const refreshPromise = service.getValidAccessToken();

      // Logout called while refresh is pending
      await service.logout();

      // Fetch fails due to network disconnection
      rejectFetch!(new Error('Network offline'));

      // Must reject with network error, NOT return old-access-token
      await expect(refreshPromise).rejects.toThrow('Network offline');
      expect(service.getStatus()).toBe('unauthenticated');
      expect(service.getSession()).toBeNull();
    });

    it('normal same-session refresh continues to work and update tokens', async () => {
      const expiringSession: GoogleAuthSession = {
        user: { sub: 'sub-normal', email: 'normal@example.com', name: 'Normal User' },
        tokens: {
          accessToken: 'token-old',
          expiresAt: Date.now() - 1000,
          sealedRefreshToken: 'sealed-normal',
        },
      };
      inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(expiringSession));

      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            accessToken: 'token-refreshed-success',
            expiresIn: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const service = createService({
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const listener = vi.fn();
      service.subscribe(listener);

      const token = await service.getValidAccessToken();
      expect(token).toBe('token-refreshed-success');
      expect(service.getStatus()).toBe('authenticated');
      expect(service.getSession()?.tokens.accessToken).toBe('token-refreshed-success');
      expect(listener).toHaveBeenCalledWith(service.getSession());

      const stored = JSON.parse(
        inMemoryStorage.getItem('lunaclair.auth.google_session')!,
      ) as GoogleAuthSession;
      expect(stored.tokens.accessToken).toBe('token-refreshed-success');
    });

    it('cancellation before promotion does not call promoteAnonymousVault or setActiveVaultDatabase', async () => {
      const setActiveVaultDbSpy = vi.spyOn(dbSchema, 'setActiveVaultDatabase');

      let resolveTokenFetch: (res: Response) => void;
      const tokenFetchPromise = new Promise<Response>((resolve) => {
        resolveTokenFetch = resolve;
      });

      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/auth/google/token')) {
          return tokenFetchPromise;
        }
        return new Response('Not found', { status: 404 });
      });

      const service = createService({
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const loginPromise = service.login();
      await vi.waitFor(() => expect(mockInitCodeClient).toHaveBeenCalledTimes(1));

      // Trigger GIS callback, token fetch begins
      capturedConfig?.callback?.({ code: 'pre-promo-code' });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // User logs out before token fetch resolves / before promotion
      await service.logout();

      // Resolve token fetch
      resolveTokenFetch!(
        new Response(
          JSON.stringify({
            accessToken: 'token-pre-promo',
            expiresIn: 3600,
            sub: 'sub-pre-promo',
            email: 'pre@lunaclair.dev',
            name: 'Pre Promo',
            sealedRefreshToken: 'sealed-pre-promo',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(loginPromise).rejects.toThrow(/Login cancelled: session logged out/);
      expect(mockVaultRegistry.promoteAnonymousVault).not.toHaveBeenCalled();
      expect(setActiveVaultDbSpy).not.toHaveBeenCalled();
      expect(service.getStatus()).toBe('unauthenticated');
      expect(service.getSession()).toBeNull();
      setActiveVaultDbSpy.mockRestore();
    });

    it('cancellation after promotion aborts without persisting session', async () => {
      let resolvePromotion: (value: any) => void;
      const promotionPromise = new Promise((resolve) => {
        resolvePromotion = resolve;
      });

      mockVaultRegistry.promoteAnonymousVault = vi.fn(async () => {
        return (await promotionPromise) as any;
      });

      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            accessToken: 'token-post-promo',
            expiresIn: 3600,
            sub: 'sub-post-promo',
            email: 'post@lunaclair.dev',
            name: 'Post Promo',
            sealedRefreshToken: 'sealed-post-promo',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const service = createService({
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const loginPromise = service.login();
      await vi.waitFor(() => expect(mockInitCodeClient).toHaveBeenCalledTimes(1));
      capturedConfig?.callback?.({ code: 'post-promo-code' });

      await vi.waitFor(() => {
        expect(mockVaultRegistry.promoteAnonymousVault).toHaveBeenCalledWith('sub-post-promo');
      });

      // User logs out while promotion is running
      await service.logout();

      // Complete promotion
      resolvePromotion!({
        pointer: {
          ownerSub: 'sub-post-promo',
          physicalDbName: 'lc_vault_mock123',
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
        },
      });

      await expect(loginPromise).rejects.toThrow(/Login cancelled: session logged out/);
      expect(service.getStatus()).toBe('unauthenticated');
      expect(service.getSession()).toBeNull();
      expect(inMemoryStorage.getItem('lunaclair.auth.google_session')).toBeNull();
    });

    it('completed or canceled older login does not clear a newer login request single-flight promise', async () => {
      let resolveFetch1: (res: Response) => void;
      const fetchPromise1 = new Promise<Response>((resolve) => {
        resolveFetch1 = resolve;
      });

      let resolveFetch2: (res: Response) => void;
      const fetchPromise2 = new Promise<Response>((resolve) => {
        resolveFetch2 = resolve;
      });

      let fetchCount = 0;
      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/api/auth/google/token')) {
          fetchCount++;
          if (fetchCount === 1) return fetchPromise1;
          return fetchPromise2;
        }
        return new Response('Not found', { status: 404 });
      });

      const service = createService({
        customFetch: mockFetch as unknown as typeof fetch,
      });

      // 1. Start Login 1
      const login1 = service.login();
      login1.catch(() => {}); // guard against unhandled rejection warning during logout
      await vi.waitFor(() => expect(mockInitCodeClient).toHaveBeenCalledTimes(1));
      capturedConfig?.callback?.({ code: 'code-1' });

      // 2. Logout cancels Login 1
      await service.logout();

      // 3. Start Login 2
      const login2 = service.login();
      await vi.waitFor(() => expect(mockInitCodeClient).toHaveBeenCalledTimes(2));

      // 4. Resolve Login 1's fetch late; Login 1 rejects due to logout
      resolveFetch1!(
        new Response(
          JSON.stringify({
            accessToken: 'token-1',
            expiresIn: 3600,
            sub: 'sub-1',
            email: 'sub1@lunaclair.dev',
            name: 'User 1',
            sealedRefreshToken: 'sealed-1',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
      await expect(login1).rejects.toThrow(/Login cancelled: session logged out/);

      // 5. Calling login() while Login 2 is in flight returns Login 2's promise (single flight maintained)
      const concurrentCall = service.login();
      expect(concurrentCall).toBe(login2);

      // 6. Complete Login 2
      capturedConfig?.callback?.({ code: 'code-2' });
      resolveFetch2!(
        new Response(
          JSON.stringify({
            accessToken: 'token-2',
            expiresIn: 3600,
            sub: 'sub-2',
            email: 'sub2@lunaclair.dev',
            name: 'User 2',
            sealedRefreshToken: 'sealed-2',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const [res2, resConcurrent] = await Promise.all([login2, concurrentCall]);
      expect(res2.user.sub).toBe('sub-2');
      expect(resConcurrent.user.sub).toBe('sub-2');
      expect(mockInitCodeClient).toHaveBeenCalledTimes(2);
    });
  });

  describe('getValidAccessToken with expectedSub', () => {
    it('rejects with session mismatch error when unauthenticated and expectedSub is provided', async () => {
      const service = createService();
      await expect(service.getValidAccessToken(false, 'expected-sub-999')).rejects.toThrow(
        'Session mismatch: expected token for expected-sub-999, but active session is unauthenticated',
      );
    });

    it('rejects with session mismatch error when authenticated session sub does not match expectedSub', async () => {
      const validSession: GoogleAuthSession = {
        user: { sub: 'active-sub-111', email: 'user@example.com', name: 'User' },
        tokens: {
          accessToken: 'active-token',
          expiresAt: Date.now() + 10 * 60 * 1000,
          sealedRefreshToken: 'sealed-token',
        },
      };
      inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(validSession));
      const service = createService();

      await expect(service.getValidAccessToken(false, 'expected-sub-222')).rejects.toThrow(
        'Session mismatch: expected token for expected-sub-222, but active session is active-sub-111',
      );
    });

    it('returns access token when authenticated session sub matches expectedSub', async () => {
      const validSession: GoogleAuthSession = {
        user: { sub: 'matching-sub-333', email: 'user@example.com', name: 'User' },
        tokens: {
          accessToken: 'matching-token',
          expiresAt: Date.now() + 10 * 60 * 1000,
          sealedRefreshToken: 'sealed-token',
        },
      };
      inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(validSession));
      const service = createService();

      const token = await service.getValidAccessToken(false, 'matching-sub-333');
      expect(token).toBe('matching-token');
    });

    it('deduplicates concurrent refresh calls when expectedSub matches', async () => {
      const expiringSession: GoogleAuthSession = {
        user: { sub: 'sub-scoped-dedup', email: 'user@example.com', name: 'User' },
        tokens: {
          accessToken: 'old-token',
          expiresAt: Date.now() - 1000,
          sealedRefreshToken: 'sealed-token',
        },
      };
      inMemoryStorage.setItem('lunaclair.auth.google_session', JSON.stringify(expiringSession));

      const mockFetch = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new Response(JSON.stringify({ accessToken: 'new-scoped-token', expiresIn: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const service = createService({
        customFetch: mockFetch as unknown as typeof fetch,
      });

      const [t1, t2] = await Promise.all([
        service.getValidAccessToken(false, 'sub-scoped-dedup'),
        service.getValidAccessToken(false, 'sub-scoped-dedup'),
      ]);

      expect(t1).toBe('new-scoped-token');
      expect(t2).toBe('new-scoped-token');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
