/**
 * Google Identity Services (GIS) dynamic script loader.
 *
 * Idempotently and dynamically loads `https://accounts.google.com/gsi/client`.
 * Reuses existing script tags if present, handles errors, and ensures cleanup on failure.
 */

export interface GisCodeResponse {
  code?: string;
  scope?: string;
  state?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

export interface GisErrorResponse {
  type: string;
  message?: string;
}

export interface GisCodeClientConfig {
  client_id: string;
  scope: string;
  ux_mode?: 'popup' | 'redirect';
  redirect_uri?: string;
  callback?: (response: GisCodeResponse) => void;
  error_callback?: (error: GisErrorResponse) => void;
  select_account?: boolean;
  access_type?: 'offline' | 'online';
  prompt?: string;
}

export interface GisCodeClient {
  requestCode(): void;
}

export interface GoogleAccountsOAuth2 {
  initCodeClient(config: GisCodeClientConfig): GisCodeClient;
  revoke?(accessToken: string, done?: () => void): void;
}

export interface GoogleAccounts {
  oauth2: GoogleAccountsOAuth2;
  id?: unknown;
}

export interface GoogleGlobal {
  accounts: GoogleAccounts;
}

declare global {
  interface Window {
    google?: GoogleGlobal;
  }
}

export const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let inFlightPromise: Promise<GoogleGlobal> | null = null;

/**
 * Returns true if the GIS client library is currently loaded and available.
 */
export function isGisLoaded(): boolean {
  return typeof window !== 'undefined' && Boolean(window.google?.accounts?.oauth2);
}

/**
 * Dynamically and idempotently loads the Google Identity Services SDK script.
 * Reuses existing script tags or ongoing network promises.
 */
export function loadGisScript(scriptUrl: string = GIS_SCRIPT_URL): Promise<GoogleGlobal> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(
      new Error('GIS script loader requires a browser environment with window and document.'),
    );
  }

  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(window.google);
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = new Promise<GoogleGlobal>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);

    const handleSuccess = () => {
      inFlightPromise = null;
      if (window.google?.accounts?.oauth2) {
        resolve(window.google);
      } else {
        cleanup();
        reject(
          new Error(
            'Google Identity Services script loaded successfully, but window.google.accounts.oauth2 was not initialized.',
          ),
        );
      }
    };

    const handleError = () => {
      cleanup();
      reject(new Error(`Failed to load Google Identity Services script from ${scriptUrl}`));
    };

    const cleanup = () => {
      inFlightPromise = null;
      if (script) {
        script.removeEventListener('load', handleSuccess);
        script.removeEventListener('error', handleError);
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }
    };

    if (script) {
      if (window.google?.accounts?.oauth2) {
        inFlightPromise = null;
        resolve(window.google);
        return;
      }
      script.addEventListener('load', handleSuccess, { once: true });
      script.addEventListener('error', handleError, { once: true });
      return;
    }

    script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', handleSuccess, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.head.appendChild(script);
  });

  return inFlightPromise;
}

/**
 * Resets the in-flight promise cache. Useful in testing and retry flows.
 */
export function resetGisScriptLoader(): void {
  inFlightPromise = null;
}
