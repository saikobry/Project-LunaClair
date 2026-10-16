/**
 * Domain contracts and models for user authentication and identity in LunaClair.
 *
 * Implements Pattern B+ stateless authentication models (ADR-018 / BYOS architecture).
 * No UI or React dependencies.
 */

/**
 * Public profile information returned by Google OAuth.
 */
export interface GoogleUserProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * Tokens returned from authentication exchange and refresh.
 *
 * `sealedRefreshToken` is an AES-256-GCM sealed ciphertext encrypted by the
 * Cloudflare Worker with `AUTH_MASTER_KEY` and AAD `sub`. It contains zero plaintext secret.
 * `expiresAt` is the epoch timestamp in milliseconds when the `accessToken` expires.
 */
export interface GoogleAuthTokens {
  accessToken: string;
  expiresAt: number;
  sealedRefreshToken: string;
}

/**
 * Active authenticated session containing profile and current credentials.
 */
export interface GoogleAuthSession {
  user: GoogleUserProfile;
  tokens: GoogleAuthTokens;
}

/**
 * Current lifecycle state of authentication.
 */
export type AuthStatus = 'unauthenticated' | 'authenticated' | 'authenticating' | 'standby';

/**
 * Capability port for Google authentication operations.
 */
export interface GoogleAuthPort {
  /**
   * Initiates Google OAuth 2.0 flow via GIS popup and exchanges auth code.
   */
  login(): Promise<GoogleAuthSession>;

  /**
   * Clears local session and sealed token.
   */
  logout(): Promise<void>;

  /**
   * Resolves a valid access token.
   * If current token expires within 2 minutes (or is expired), performs a silent refresh.
   * If `force` is true, forces a token refresh regardless of expiration.
   */
  getValidAccessToken(force?: boolean): Promise<string>;

  /**
   * Forces a refresh of the access token using the stored sealed refresh token.
   */
  refreshAccessToken?(): Promise<string>;

  /**
   * Returns active session if authenticated, or null.
   */
  getSession(): GoogleAuthSession | null;

  /**
   * Returns current authentication status.
   */
  getStatus(): AuthStatus;

  /**
   * Subscribes to session state changes. Returns an unsubscribe callback.
   */
  subscribe(listener: (session: GoogleAuthSession | null) => void): () => void;
}
