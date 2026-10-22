/**
 * Google authentication infrastructure service for LunaClair.
 *
 * Implements Pattern B+ stateless authentication using Google Identity Services (GIS)
 * and Cloudflare Worker endpoints (/api/auth/google/token, /api/auth/google/refresh).
 *
 * Governed by ADR-015 and ADR-018.
 */
import type {
  AuthStatus,
  GoogleAuthPort,
  GoogleAuthSession,
} from '../../../domain/auth/models/auth.types';
import type {
  PromotionResult,
  VaultRegistryPort,
} from '../../../domain/vault/models/vault.types';
import { STORAGE_KEYS } from '../../../shared/constants/storageKeys';
import { vaultRegistry as defaultVaultRegistry } from '../../database/registry/VaultRegistry';
import {
  openVaultDatabase,
  setActiveVaultDatabase,
  getActiveVaultDatabase,
} from '../../database/schema/LunaClairDatabase';
import {
  loadGisScript,
  type GisCodeResponse,
  type GisErrorResponse,
  type GoogleGlobal,
} from './loadGis';

export const DEFAULT_GOOGLE_SCOPES =
  'openid email profile https://www.googleapis.com/auth/drive.appdata';

export const TOKEN_REFRESH_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export interface AuthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface GoogleAuthServiceOptions {
  clientId?: string;
  apiBaseUrl?: string;
  scopes?: string;
  storageKey?: string;
  storage?: AuthStorage;
  loadGis?: (url?: string) => Promise<GoogleGlobal>;
  customFetch?: typeof fetch;
  vaultRegistry?: VaultRegistryPort;
}

interface TokenExchangeResponse {
  accessToken: string;
  expiresIn: number;
  sub: string;
  email: string;
  name: string;
  picture?: string;
  sealedRefreshToken: string;
}

interface TokenRefreshResponse {
  accessToken: string;
  expiresIn: number;
}

interface ActiveRefreshEntry {
  generation: number;
  sub: string;
  promise: Promise<string>;
}

/**
 * Concrete infrastructure adapter implementing GoogleAuthPort.
 */
export class GoogleAuthService implements GoogleAuthPort {
  private readonly clientId: string;
  private readonly apiBaseUrl: string;
  private readonly scopes: string;
  private readonly storageKey: string;
  private readonly storage: AuthStorage;
  private readonly loadGisFn: (url?: string) => Promise<GoogleGlobal>;
  private readonly fetchFn: typeof fetch;
  private readonly vaultRegistry: VaultRegistryPort;

  private session: GoogleAuthSession | null;
  private status: AuthStatus;
  private sessionGeneration: number;
  private readonly listeners: Set<(session: GoogleAuthSession | null) => void>;
  private loginPromise: Promise<GoogleAuthSession> | null;
  private currentLoginRequestId: number;
  private loginCancelFn: ((err: Error) => void) | null;
  private activeRefresh: ActiveRefreshEntry | null;
  private lastPromotionResult: PromotionResult | null;

  constructor(options: GoogleAuthServiceOptions = {}) {
    const envClientId =
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      typeof import.meta.env.VITE_GOOGLE_CLIENT_ID === 'string'
        ? import.meta.env.VITE_GOOGLE_CLIENT_ID.trim()
        : '';

    this.clientId = options.clientId ?? envClientId;
    this.apiBaseUrl = options.apiBaseUrl ?? '';
    this.scopes = options.scopes ?? DEFAULT_GOOGLE_SCOPES;
    this.storageKey = options.storageKey ?? STORAGE_KEYS.auth.googleSession;

    this.storage =
      options.storage ??
      (typeof localStorage !== 'undefined'
        ? localStorage
        : {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          });

    this.loadGisFn = options.loadGis ?? loadGisScript;
    this.fetchFn =
      options.customFetch ??
      (typeof fetch !== 'undefined'
        ? typeof window !== 'undefined'
          ? fetch.bind(window)
          : fetch
        : async () => {
            throw new Error('fetch is unavailable in this environment');
          });

    this.vaultRegistry = options.vaultRegistry ?? defaultVaultRegistry;
    this.lastPromotionResult = null;

    this.sessionGeneration = 0;
    this.listeners = new Set();
    this.loginPromise = null;
    this.loginCancelFn = null;
    this.currentLoginRequestId = 0;
    this.activeRefresh = null;

    this.session = this.readSessionFromStorage();
    this.status = this.session ? 'authenticated' : 'unauthenticated';
  }

  /**
   * Returns current active session or null if unauthenticated.
   */
  getSession(): GoogleAuthSession | null {
    if (!this.session) {
      this.session = this.readSessionFromStorage();
    }
    return this.session;
  }

  /**
   * Returns current authentication status.
   */
  getStatus(): AuthStatus {
    return this.status;
  }

  /**
   * Returns monotonically increasing session generation counter for active session epoch.
   * Increments on logout and when establishing a newly authenticated session.
   */
  getSessionGeneration(): number {
    return this.sessionGeneration;
  }

  /**
   * Returns the outcome of the most recent vault promotion, or null if none occurred.
   */
  getLastPromotionResult(): PromotionResult | null {
    return this.lastPromotionResult;
  }

  /**
   * Subscribes to authentication session changes.
   */
  subscribe(listener: (session: GoogleAuthSession | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Initiates Google OAuth popup and exchanges authorization code for tokens.
   */
  login(): Promise<GoogleAuthSession> {
    if (this.loginPromise) {
      return this.loginPromise;
    }

    const requestId = ++this.currentLoginRequestId;
    const promise = this.executeLoginFlow();
    const loginPromise = promise.finally(() => {
      if (this.currentLoginRequestId === requestId) {
        this.loginPromise = null;
      }
    });
    this.loginPromise = loginPromise;
    return loginPromise;
  }

  /**
   * Returns a valid access token. Automatically triggers silent refresh if expiring within 2 minutes
   * or if force is true.
   * If expectedSub is provided, validates that the active session matches this user sub.
   */
  async getValidAccessToken(force = false, expectedSub?: string): Promise<string> {
    if (!this.session) {
      this.session = this.readSessionFromStorage();
    }

    if (expectedSub && this.session?.user.sub !== expectedSub) {
      throw new Error(
        'Session mismatch: expected token for ' +
          expectedSub +
          ', but active session is ' +
          (this.session?.user.sub ?? 'unauthenticated'),
      );
    }

    if (!this.session) {
      throw new Error('No active Google authentication session.');
    }

    const now = Date.now();
    const timeRemaining = this.session.tokens.expiresAt - now;

    if (!force && timeRemaining > TOKEN_REFRESH_THRESHOLD_MS) {
      return this.session.tokens.accessToken;
    }

    const currentGeneration = this.sessionGeneration;
    const currentSub = this.session.user.sub;

    if (
      this.activeRefresh &&
      this.activeRefresh.generation === currentGeneration &&
      this.activeRefresh.sub === currentSub &&
      (!expectedSub || expectedSub === currentSub)
    ) {
      return this.activeRefresh.promise;
    }

    const refreshPromise = this.performTokenRefresh();
    this.activeRefresh = {
      generation: currentGeneration,
      sub: currentSub,
      promise: refreshPromise,
    };

    try {
      return await refreshPromise;
    } finally {
      if (this.activeRefresh?.promise === refreshPromise) {
        this.activeRefresh = null;
      }
    }
  }

  /**
   * Explicitly forces a token refresh, bypassing expiration threshold checks.
   */
  async refreshAccessToken(expectedSub?: string): Promise<string> {
    return this.getValidAccessToken(true, expectedSub);
  }

  /**
   * Logs out the user, clears session storage and sealed refresh token.
   */
  async logout(): Promise<void> {
    this.sessionGeneration++;
    this.currentLoginRequestId++;
    this.activeRefresh = null;
    if (this.loginCancelFn) {
      this.loginCancelFn(new Error('Login cancelled: session logged out.'));
      this.loginCancelFn = null;
    }
    this.loginPromise = null;

    const currentToken = this.session?.tokens.accessToken;
    this.session = null;
    this.status = 'unauthenticated';
    this.removeSessionFromStorage();
    this.notifyListeners(null);

    if (
      currentToken &&
      typeof window !== 'undefined' &&
      window.google?.accounts?.oauth2?.revoke
    ) {
      try {
        window.google.accounts.oauth2.revoke(currentToken);
      } catch {
        // Revocation error is non-fatal for local session logout
      }
    }
  }

  private executeLoginFlow(): Promise<GoogleAuthSession> {
    if (!this.clientId) {
      return Promise.reject(
        new Error(
          'Missing Google Client ID configuration. Provide clientId in options or set VITE_GOOGLE_CLIENT_ID.',
        ),
      );
    }

    const loginGeneration = this.sessionGeneration;
    this.status = 'authenticating';

    return new Promise<GoogleAuthSession>((resolve, reject) => {
      let settled = false;

      const cleanup = (error?: Error, session?: GoogleAuthSession) => {
        if (settled) return;
        settled = true;
        this.loginCancelFn = null;
        if (error) {
          if (this.sessionGeneration === loginGeneration) {
            this.status = this.session ? 'authenticated' : 'unauthenticated';
          }
          reject(error);
        } else if (session) {
          if (this.session === session) {
            this.status = 'authenticated';
            resolve(session);
          } else {
            reject(new Error('Login cancelled: session logged out.'));
          }
        }
      };

      this.loginCancelFn = (err: Error) => cleanup(err);

      this.loadGisFn()
        .then((google) => {
          if (settled || this.sessionGeneration !== loginGeneration) {
            cleanup(new Error('Login cancelled: session logged out.'));
            return;
          }

          try {
            const client = google.accounts.oauth2.initCodeClient({
              client_id: this.clientId,
              scope: this.scopes,
              ux_mode: 'popup',
              redirect_uri: 'postmessage',
              callback: async (response: GisCodeResponse) => {
                if (settled || this.sessionGeneration !== loginGeneration) {
                  cleanup(new Error('Login cancelled: session logged out.'));
                  return;
                }
                if (response.error) {
                  cleanup(new Error(response.error_description || response.error));
                  return;
                }
                if (!response.code) {
                  cleanup(new Error('No authorization code returned by Google Identity Services.'));
                  return;
                }
                try {
                  const session = await this.exchangeCodeForSession(response.code, loginGeneration);
                  cleanup(undefined, session);
                } catch (err) {
                  cleanup(err instanceof Error ? err : new Error(String(err)));
                }
              },
              error_callback: (err: GisErrorResponse) => {
                if (settled || this.sessionGeneration !== loginGeneration) {
                  cleanup(new Error('Login cancelled: session logged out.'));
                  return;
                }
                cleanup(new Error(err.message || `Google OAuth error: ${err.type}`));
              },
            });

            client.requestCode();
          } catch (err) {
            cleanup(err instanceof Error ? err : new Error(String(err)));
          }
        })
        .catch((err) => {
          cleanup(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }

  private async exchangeCodeForSession(
    code: string,
    loginGeneration?: number,
  ): Promise<GoogleAuthSession> {
    const url = `${this.apiBaseUrl}/api/auth/google/token`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        redirectUri: 'postmessage',
        clientId: this.clientId,
      }),
    });

    if (loginGeneration !== undefined && this.sessionGeneration !== loginGeneration) {
      throw new Error('Login cancelled: session logged out.');
    }

    if (!res.ok) {
      let message = 'Failed to exchange authorization code with Google';
      try {
        const errJson = (await res.json()) as { message?: string; error?: string };
        message = errJson.message || errJson.error || message;
      } catch {
        // Non-JSON response body
      }
      throw new Error(message);
    }

    const data = (await res.json()) as TokenExchangeResponse;

    if (loginGeneration !== undefined && this.sessionGeneration !== loginGeneration) {
      throw new Error('Login cancelled: session logged out.');
    }

    const expiresAt = Date.now() + (data.expiresIn ?? 3600) * 1000;
    const session: GoogleAuthSession = {
      user: {
        sub: data.sub,
        email: data.email,
        name: data.name,
        picture: data.picture,
      },
      tokens: {
        accessToken: data.accessToken,
        expiresAt,
        sealedRefreshToken: data.sealedRefreshToken,
      },
    };

    if (loginGeneration !== undefined && this.sessionGeneration !== loginGeneration) {
      throw new Error('Login cancelled: session logged out.');
    }

    const promotionResult = await this.vaultRegistry.promoteAnonymousVault(session.user.sub);

    if (loginGeneration !== undefined && this.sessionGeneration !== loginGeneration) {
      throw new Error('Login cancelled: session logged out.');
    }

    this.lastPromotionResult = promotionResult;
    if (promotionResult.collisionFromAnonDb) {
      console.warn(
        `[GoogleAuthService] Vault collision detected: user ${session.user.sub} already had a vault. Anonymous vault ${promotionResult.collisionFromAnonDb} retained for reconciliation.`,
      );
    }
    if (promotionResult.pointer.physicalDbName !== getActiveVaultDatabase().name) {
      const targetDb = openVaultDatabase(promotionResult.pointer.physicalDbName);
      setActiveVaultDatabase(targetDb);
    }

    this.sessionGeneration++;
    this.session = session;
    this.status = 'authenticated';
    this.writeSessionToStorage(session);
    this.notifyListeners(session);

    return session;
  }

  private async performTokenRefresh(): Promise<string> {
    if (!this.session) {
      throw new Error('Cannot refresh token: no active session.');
    }

    const initialGeneration = this.sessionGeneration;
    const initialSub = this.session.user.sub;
    const { user, tokens } = this.session;
    const url = `${this.apiBaseUrl}/api/auth/google/refresh`;

    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sub: user.sub,
          sealedRefreshToken: tokens.sealedRefreshToken,
          clientId: this.clientId,
        }),
      });
    } catch (netErr) {
      const isStale =
        this.sessionGeneration !== initialGeneration ||
        this.session?.user.sub !== initialSub;

      if (!isStale) {
        const timeRemaining = tokens.expiresAt - Date.now();
        if (timeRemaining > 0) {
          return tokens.accessToken;
        }
      }
      throw netErr;
    }

    if (!res.ok) {
      let errMessage = 'Failed to refresh token with Google';
      let errCode = '';
      try {
        const errJson = (await res.json()) as { error?: string; message?: string };
        errCode = errJson.error || '';
        errMessage = errJson.message || errJson.error || errMessage;
      } catch {
        // Non-JSON body
      }

      const isCurrentSession =
        this.sessionGeneration === initialGeneration &&
        this.session?.user.sub === initialSub;

      if (res.status === 401 || errCode === 'invalid_grant') {
        if (isCurrentSession) {
          await this.logout();
        }
        throw new Error(`Authentication expired: ${errMessage}`);
      }

      if (isCurrentSession) {
        const timeRemaining = tokens.expiresAt - Date.now();
        if (timeRemaining > 0) {
          return tokens.accessToken;
        }
      }

      throw new Error(errMessage);
    }

    const data = (await res.json()) as TokenRefreshResponse;

    const isStale =
      this.sessionGeneration !== initialGeneration ||
      this.session?.user.sub !== initialSub;

    if (isStale) {
      throw new Error('Token refresh aborted: session identity changed during refresh');
    }

    const newExpiresAt = Date.now() + (data.expiresIn ?? 3600) * 1000;
    const updatedSession: GoogleAuthSession = {
      ...this.session,
      tokens: {
        ...this.session.tokens,
        accessToken: data.accessToken,
        expiresAt: newExpiresAt,
      },
    };

    this.session = updatedSession;
    this.status = 'authenticated';
    this.writeSessionToStorage(updatedSession);
    this.notifyListeners(updatedSession);

    return data.accessToken;
  }

  private readSessionFromStorage(): GoogleAuthSession | null {
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as GoogleAuthSession;
      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.user &&
        typeof parsed.user.sub === 'string' &&
        typeof parsed.user.email === 'string' &&
        typeof parsed.user.name === 'string' &&
        parsed.tokens &&
        typeof parsed.tokens.accessToken === 'string' &&
        typeof parsed.tokens.expiresAt === 'number' &&
        typeof parsed.tokens.sealedRefreshToken === 'string'
      ) {
        return parsed;
      }
    } catch {
      // Ignore corrupted storage entry
    }
    return null;
  }

  private writeSessionToStorage(session: GoogleAuthSession): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(session));
    } catch {
      // LocalStorage quota or access error
    }
  }

  private removeSessionFromStorage(): void {
    try {
      this.storage.removeItem(this.storageKey);
    } catch {
      // LocalStorage access error
    }
  }

  private notifyListeners(session: GoogleAuthSession | null): void {
    for (const listener of this.listeners) {
      try {
        listener(session);
      } catch {
        // Prevent listener exception from disrupting notification dispatch
      }
    }
  }
}

export const googleAuthService = new GoogleAuthService();
