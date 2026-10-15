import { afterEach, describe, expect, it, vi } from 'vitest';
import { bytesToBase64Url, seal, unseal } from '../../core/crypto';
import type { Env, RouteContext } from '../../core/types';
import { createRouter } from '../../router';
import {
  decodeJwtPayload,
  GOOGLE_TOKEN_ENDPOINT,
  handleGoogleTokenExchange,
  handleGoogleTokenRefresh,
} from '../auth';

const TEST_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const TEST_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
const TEST_CLIENT_SECRET = 'test-client-secret-xyz';

function makeMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    GOOGLE_CLIENT_ID: TEST_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: TEST_CLIENT_SECRET,
    AUTH_MASTER_KEY: TEST_MASTER_KEY,
    ...overrides,
  };
}

function makeFakeJwt(payload: Record<string, unknown>): string {
  const encoder = new TextEncoder();
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${header}.${body}.mock-signature`;
}

function makeContext(
  request: Request,
  env: Env = makeMockEnv(),
  corsHeaders: Record<string, string> = { 'access-control-allow-origin': '*' },
): RouteContext {
  return {
    request,
    env,
    url: new URL(request.url),
    params: {},
    corsHeaders,
  };
}

describe('Stateless Google OAuth Routes', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('JWT payload decoding helper', () => {
    it('decodes standard base64url JSON payload with UTF-8 support', () => {
      const payload = {
        sub: '123456789',
        name: 'Élodie Renée',
        email: 'elodie@example.com',
      };
      const jwt = makeFakeJwt(payload);
      const decoded = decodeJwtPayload(jwt);
      expect(decoded).toMatchObject(payload);
    });

    it('returns null on malformed or non-jwt strings', () => {
      expect(decodeJwtPayload('invalid')).toBeNull();
      expect(decodeJwtPayload('a.invalid-base64-payload!!!.c')).toBeNull();
    });
  });

  describe('POST /api/auth/google/token (handleGoogleTokenExchange)', () => {
    it('exchanges code for tokens, parses user profile from id_token, and seals refresh_token', async () => {
      const fakeIdToken = makeFakeJwt({
        sub: 'google-sub-42',
        email: 'student@lunaclair.dev',
        name: 'Clair Reader',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
      });

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'ya29.fake-access-token-123',
            expires_in: 3599,
            refresh_token: '1//0gRealRefreshTokenSecretFromGoogle',
            id_token: fakeIdToken,
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      globalThis.fetch = fetchMock;

      const request = new Request('https://api.lunaclair.dev/api/auth/google/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'auth-code-xyz', redirectUri: 'https://app.lunaclair.dev/oauth' }),
      });

      const response = await handleGoogleTokenExchange(makeContext(request));
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        accessToken: string;
        expiresIn: number;
        sub: string;
        email: string;
        name: string;
        picture: string;
        sealedRefreshToken: string;
      };

      expect(data.accessToken).toBe('ya29.fake-access-token-123');
      expect(data.expiresIn).toBe(3599);
      expect(data.sub).toBe('google-sub-42');
      expect(data.email).toBe('student@lunaclair.dev');
      expect(data.name).toBe('Clair Reader');
      expect(data.picture).toBe('https://lh3.googleusercontent.com/photo.jpg');
      expect(data.sealedRefreshToken).toBeTypeOf('string');

      // Verify sealedRefreshToken unseals correctly with the sub as AAD
      const unsealed = await unseal(data.sealedRefreshToken, TEST_MASTER_KEY, 'google-sub-42');
      expect(unsealed).toBe('1//0gRealRefreshTokenSecretFromGoogle');

      // Verify Google token endpoint was called with correct parameters
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toBe(GOOGLE_TOKEN_ENDPOINT);
      expect(calledInit.method).toBe('POST');
      const params = new URLSearchParams(calledInit.body as string);
      expect(params.get('code')).toBe('auth-code-xyz');
      expect(params.get('client_id')).toBe(TEST_CLIENT_ID);
      expect(params.get('client_secret')).toBe(TEST_CLIENT_SECRET);
      expect(params.get('redirect_uri')).toBe('https://app.lunaclair.dev/oauth');
      expect(params.get('grant_type')).toBe('authorization_code');
    });

    it('defaults redirect_uri to "postmessage" when not specified', async () => {
      const fakeIdToken = makeFakeJwt({ sub: 'google-sub-1' });
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'acc-token',
            expires_in: 3600,
            refresh_token: 'ref-token',
            id_token: fakeIdToken,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      globalThis.fetch = fetchMock;

      const request = new Request('https://api.lunaclair.dev/api/auth/google/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'auth-code-123' }),
      });

      const response = await handleGoogleTokenExchange(makeContext(request));
      expect(response.status).toBe(200);

      const params = new URLSearchParams(fetchMock.mock.calls[0][1]?.body as string);
      expect(params.get('redirect_uri')).toBe('postmessage');
    });

    it('rejects invalid or missing JSON body', async () => {
      const request = new Request('https://api.lunaclair.dev/api/auth/google/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid-json{',
      });
      const response = await handleGoogleTokenExchange(makeContext(request));
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe('Invalid JSON body');
    });

    it('rejects missing or empty authorization code', async () => {
      const request = new Request('https://api.lunaclair.dev/api/auth/google/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: '   ' }),
      });
      const response = await handleGoogleTokenExchange(makeContext(request));
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe('Missing or invalid "code" parameter');
    });

    it('returns 500 when environment variables are missing', async () => {
      const makeReq = () =>
        new Request('https://api.lunaclair.dev/api/auth/google/token', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: 'code-123' }),
        });

      // Missing client secret
      const res1 = await handleGoogleTokenExchange(makeContext(makeReq(), makeMockEnv({ GOOGLE_CLIENT_SECRET: undefined })));
      expect(res1.status).toBe(500);

      // Missing master key
      const res2 = await handleGoogleTokenExchange(makeContext(makeReq(), makeMockEnv({ AUTH_MASTER_KEY: undefined })));
      expect(res2.status).toBe(500);

      // Missing client ID
      const res3 = await handleGoogleTokenExchange(makeContext(makeReq(), makeMockEnv({ GOOGLE_CLIENT_ID: undefined })));
      expect(res3.status).toBe(500);
    });

    it('propagates Google 400 invalid_grant error as 401', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: 'invalid_grant', error_description: 'Code was already redeemed' }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      );

      const request = new Request('https://api.lunaclair.dev/api/auth/google/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'expired-code' }),
      });

      const response = await handleGoogleTokenExchange(makeContext(request));
      expect(response.status).toBe(401);
      const data = (await response.json()) as { error: string; message: string };
      expect(data.error).toBe('invalid_grant');
      expect(data.message).toBe('Code was already redeemed');
    });

    it('handles Google 500 as 502 Bad Gateway', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: 'internal_failure', error_description: 'Google outage' }),
          { status: 500, headers: { 'content-type': 'application/json' } },
        ),
      );

      const request = new Request('https://api.lunaclair.dev/api/auth/google/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'valid-code' }),
      });

      const response = await handleGoogleTokenExchange(makeContext(request));
      expect(response.status).toBe(502);
    });

    it('returns 400 when Google response is missing refresh_token', async () => {
      const fakeIdToken = makeFakeJwt({ sub: 'google-sub-no-refresh' });
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'acc-token',
            expires_in: 3600,
            id_token: fakeIdToken,
            // refresh_token intentionally omitted
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

      const request = new Request('https://api.lunaclair.dev/api/auth/google/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'code-no-refresh' }),
      });

      const response = await handleGoogleTokenExchange(makeContext(request));
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain('No refresh token returned by Google');
    });

    it('returns 400 when Google response is missing id_token', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'acc-token',
            expires_in: 3600,
            refresh_token: 'ref-token',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

      const request = new Request('https://api.lunaclair.dev/api/auth/google/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'code-123' }),
      });

      const response = await handleGoogleTokenExchange(makeContext(request));
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain('missing id_token');
    });
  });

  describe('POST /api/auth/google/refresh (handleGoogleTokenRefresh)', () => {
    it('unseals refresh_token with sub as AAD and exchanges for a new accessToken', async () => {
      const originalRefreshToken = '1//0gSecretStoredRefreshToken123';
      const userSub = 'google-sub-user-99';
      const sealedToken = await seal(originalRefreshToken, TEST_MASTER_KEY, userSub);

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'ya29.refreshed-new-access-token',
            expires_in: 3600,
            token_type: 'Bearer',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
      globalThis.fetch = fetchMock;

      const request = new Request('https://api.lunaclair.dev/api/auth/google/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sub: userSub, sealedRefreshToken: sealedToken }),
      });

      const response = await handleGoogleTokenRefresh(makeContext(request));
      expect(response.status).toBe(200);

      const data = (await response.json()) as { accessToken: string; expiresIn: number };
      expect(data.accessToken).toBe('ya29.refreshed-new-access-token');
      expect(data.expiresIn).toBe(3600);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toBe(GOOGLE_TOKEN_ENDPOINT);
      const params = new URLSearchParams(calledInit.body as string);
      expect(params.get('client_id')).toBe(TEST_CLIENT_ID);
      expect(params.get('client_secret')).toBe(TEST_CLIENT_SECRET);
      expect(params.get('refresh_token')).toBe(originalRefreshToken);
      expect(params.get('grant_type')).toBe('refresh_token');
    });

    it('rejects with 401 when AAD (sub) does not match the sealed token', async () => {
      const sealedToken = await seal('real-refresh-token', TEST_MASTER_KEY, 'original-user-sub');

      const request = new Request('https://api.lunaclair.dev/api/auth/google/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sub: 'attacker-sub', sealedRefreshToken: sealedToken }),
      });

      const response = await handleGoogleTokenRefresh(makeContext(request));
      expect(response.status).toBe(401);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain('identity mismatch');
    });

    it('rejects with 401 when sealedRefreshToken is corrupt or tampered', async () => {
      const request = new Request('https://api.lunaclair.dev/api/auth/google/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sub: 'user-sub', sealedRefreshToken: 'tampered.token.not.valid' }),
      });

      const response = await handleGoogleTokenRefresh(makeContext(request));
      expect(response.status).toBe(401);
    });

    it('rejects missing or empty sub or sealedRefreshToken', async () => {
      const res1 = await handleGoogleTokenRefresh(
        makeContext(
          new Request('https://api.lunaclair.dev/api/auth/google/refresh', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sub: '', sealedRefreshToken: 'abc' }),
          }),
        ),
      );
      expect(res1.status).toBe(400);

      const res2 = await handleGoogleTokenRefresh(
        makeContext(
          new Request('https://api.lunaclair.dev/api/auth/google/refresh', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sub: 'sub-1', sealedRefreshToken: '' }),
          }),
        ),
      );
      expect(res2.status).toBe(400);
    });

    it('returns 401 when Google rejects refresh with invalid_grant', async () => {
      const sealedToken = await seal('revoked-refresh-token', TEST_MASTER_KEY, 'user-sub-revoked');

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      );

      const request = new Request('https://api.lunaclair.dev/api/auth/google/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sub: 'user-sub-revoked', sealedRefreshToken: sealedToken }),
      });

      const response = await handleGoogleTokenRefresh(makeContext(request));
      expect(response.status).toBe(401);
      const data = (await response.json()) as { error: string; message: string };
      expect(data.error).toBe('invalid_grant');
      expect(data.message).toBe('Token has been expired or revoked.');
    });
  });

  describe('Router integration', () => {
    it('dispatches to /api/auth/google/token and /api/auth/google/refresh with CORS', async () => {
      const router = createRouter();
      const env = makeMockEnv();
      const corsHeaders = { 'access-control-allow-origin': 'https://app.lunaclair.dev' };

      // Test token route dispatch
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'acc',
            expires_in: 3600,
            refresh_token: 'ref',
            id_token: makeFakeJwt({ sub: 'sub-dispatch' }),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

      const tokenReq = new Request('https://api.lunaclair.dev/api/auth/google/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'dispatch-code' }),
      });

      const tokenRes = await router.handle(tokenReq, env, corsHeaders);
      expect(tokenRes.status).toBe(200);
      expect(tokenRes.headers.get('access-control-allow-origin')).toBe('https://app.lunaclair.dev');

      // Test method not allowed (GET instead of POST)
      const getReq = new Request('https://api.lunaclair.dev/api/auth/google/token', {
        method: 'GET',
      });
      const getRes = await router.handle(getReq, env, corsHeaders);
      expect(getRes.status).toBe(405);
      expect(getRes.headers.get('allow')).toBe('POST');
    });
  });
});
