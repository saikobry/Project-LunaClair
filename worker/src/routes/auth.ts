/**
 * Stateless Google OAuth authentication routes for LunaClair.
 *
 * Implements Pattern B+ stateless token exchange and refresh:
 * - POST /api/auth/google/token   → Exchanges authorization code for tokens, seals refresh_token
 * - POST /api/auth/google/refresh → Unseals refresh_token with AAD (sub), requests new accessToken
 *
 * Zero server storage / zero database tables.
 * AES-256-GCM authenticated encryption binds the user Google `sub` as AAD
 * to prevent token transplantation across accounts.
 */
import { seal, unseal } from '../core/crypto';
import { badRequest, json, serverError, unauthorized } from '../core/responses';
import type { RouteContext } from '../core/types';

export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

interface GoogleTokenSuccessPayload {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  token_type?: string;
}

interface GoogleTokenErrorPayload {
  error?: string;
  error_description?: string;
}

/**
 * Decodes the payload portion of a JWT without cryptographic verification.
 * (Verification is implicit because the token is obtained directly from Google's TLS endpoint).
 */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    const base64Url = parts[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/google/token
 *
 * Request body: { code: string, redirectUri?: string, clientId?: string }
 * Response: { accessToken, expiresIn, sub, email, name, picture, sealedRefreshToken }
 */
export async function handleGoogleTokenExchange(ctx: RouteContext): Promise<Response> {
  const { request, env, corsHeaders } = ctx;

  let body: {
    code?: unknown;
    redirectUri?: unknown;
    clientId?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body', corsHeaders);
  }

  if (!body || typeof body !== 'object') {
    return badRequest('Request body must be a JSON object', corsHeaders);
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return badRequest('Missing or invalid "code" parameter', corsHeaders);
  }

  const redirectUri =
    typeof body.redirectUri === 'string' && body.redirectUri.trim()
      ? body.redirectUri.trim()
      : 'postmessage';

  const clientId =
    typeof body.clientId === 'string' && body.clientId.trim()
      ? body.clientId.trim()
      : env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    return serverError('Missing Google Client ID configuration', corsHeaders);
  }

  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    return serverError('Missing Google Client Secret configuration', corsHeaders);
  }

  const authMasterKey = env.AUTH_MASTER_KEY?.trim();
  if (!authMasterKey) {
    return serverError('Missing Auth Master Key configuration', corsHeaders);
  }

  const tokenParams = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const googleRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString(),
  });

  if (!googleRes.ok) {
    let errPayload: GoogleTokenErrorPayload = {};
    try {
      errPayload = (await googleRes.json()) as GoogleTokenErrorPayload;
    } catch {
      // non-JSON response
    }
    const error = errPayload.error || 'google_token_exchange_failed';
    const errorDescription =
      errPayload.error_description || 'Failed to exchange authorization code with Google';
    const status = googleRes.status === 400 || googleRes.status === 401 ? 401 : 502;
    return json({ error, message: errorDescription }, status, corsHeaders);
  }

  const tokenData = (await googleRes.json()) as GoogleTokenSuccessPayload;

  if (!tokenData.id_token) {
    return badRequest('Google response is missing id_token', corsHeaders);
  }

  const payload = decodeJwtPayload(tokenData.id_token);
  if (!payload || typeof payload.sub !== 'string' || !payload.sub.trim()) {
    return badRequest('Google id_token payload is invalid or missing sub', corsHeaders);
  }

  const sub = payload.sub.trim();
  const email = typeof payload.email === 'string' ? payload.email : '';
  const name = typeof payload.name === 'string' ? payload.name : '';
  const picture = typeof payload.picture === 'string' ? payload.picture : '';

  if (!tokenData.refresh_token || typeof tokenData.refresh_token !== 'string') {
    return badRequest(
      'No refresh token returned by Google. Ensure access_type=offline and prompt=consent were requested.',
      corsHeaders,
    );
  }

  const sealedRefreshToken = await seal(tokenData.refresh_token, authMasterKey, sub);

  return json(
    {
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
      sub,
      email,
      name,
      picture,
      sealedRefreshToken,
    },
    200,
    corsHeaders,
  );
}

/**
 * POST /api/auth/google/refresh
 *
 * Request body: { sub: string, sealedRefreshToken: string, clientId?: string }
 * Response: { accessToken, expiresIn }
 */
export async function handleGoogleTokenRefresh(ctx: RouteContext): Promise<Response> {
  const { request, env, corsHeaders } = ctx;

  let body: {
    sub?: unknown;
    sealedRefreshToken?: unknown;
    clientId?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body', corsHeaders);
  }

  if (!body || typeof body !== 'object') {
    return badRequest('Request body must be a JSON object', corsHeaders);
  }

  const sub = typeof body.sub === 'string' ? body.sub.trim() : '';
  if (!sub) {
    return badRequest('Missing or invalid "sub" parameter', corsHeaders);
  }

  const sealedRefreshToken =
    typeof body.sealedRefreshToken === 'string' ? body.sealedRefreshToken.trim() : '';
  if (!sealedRefreshToken) {
    return badRequest('Missing or invalid "sealedRefreshToken" parameter', corsHeaders);
  }

  const clientId =
    typeof body.clientId === 'string' && body.clientId.trim()
      ? body.clientId.trim()
      : env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    return serverError('Missing Google Client ID configuration', corsHeaders);
  }

  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientSecret) {
    return serverError('Missing Google Client Secret configuration', corsHeaders);
  }

  const authMasterKey = env.AUTH_MASTER_KEY?.trim();
  if (!authMasterKey) {
    return serverError('Missing Auth Master Key configuration', corsHeaders);
  }

  let refreshToken: string;
  try {
    refreshToken = await unseal(sealedRefreshToken, authMasterKey, sub);
  } catch {
    return unauthorized(
      'Invalid or corrupted sealed refresh token or identity mismatch',
      corsHeaders,
    );
  }

  const refreshParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const googleRes = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: refreshParams.toString(),
  });

  if (!googleRes.ok) {
    let errPayload: GoogleTokenErrorPayload = {};
    try {
      errPayload = (await googleRes.json()) as GoogleTokenErrorPayload;
    } catch {
      // non-JSON response
    }
    const error = errPayload.error || 'token_refresh_failed';
    const errorDescription =
      errPayload.error_description || 'Failed to refresh token with Google';
    const status =
      error === 'invalid_grant' || googleRes.status === 400 || googleRes.status === 401 ? 401 : 502;
    return json({ error, message: errorDescription }, status, corsHeaders);
  }

  const tokenData = (await googleRes.json()) as GoogleTokenSuccessPayload;

  return json(
    {
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
    },
    200,
    corsHeaders,
  );
}
