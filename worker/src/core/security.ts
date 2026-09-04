/**
 * Core security, authentication, and cryptographic primitives for the LunaClair Worker.
 */

/**
 * Constant-time token comparison (hashes both sides with SHA-256, then performs timingSafeEqual).
 */
export async function tokensMatch(a: string | undefined, b: string | undefined): Promise<boolean> {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  if (ha.byteLength !== hb.byteLength) return false;

  const subtle = crypto.subtle as unknown as { timingSafeEqual?: (a: ArrayBuffer, b: ArrayBuffer) => boolean };
  if (typeof subtle.timingSafeEqual === 'function') {
    return subtle.timingSafeEqual(ha, hb);
  }

  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) {
    diff |= va[i] ^ vb[i];
  }
  return diff === 0;
}

/**
 * Extracts Bearer token from the Authorization header if present.
 */
export function extractBearerToken(request: Request): string | undefined {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return undefined;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}

/**
 * Extracts userId from Authorization Bearer token (authoritative) or x-user-id header.
 * Derives userId from valid JWT claims (`sub` or `userId`) or raw token string.
 * Defaults to 'user_default'.
 */
export function resolveUserId(request: Request): string {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      const token = match[1].trim();
      if (token.includes('.')) {
        try {
          const parts = token.split('.');
          if (parts.length >= 2) {
            const rawPayload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(rawPayload) as Record<string, unknown>;
            if (payload && typeof payload.sub === 'string' && payload.sub.trim().length > 0) {
              return payload.sub.trim();
            }
            if (payload && typeof payload.userId === 'string' && payload.userId.trim().length > 0) {
              return payload.userId.trim();
            }
          }
        } catch {
          // Token is not base64 JSON, continue to raw token string fallback
        }
      }
      if (token && token !== 'undefined' && token !== 'null') {
        return token;
      }
    }
  }

  const customHeaderUser = request.headers.get('x-user-id');
  if (customHeaderUser && customHeaderUser.trim().length > 0) {
    return customHeaderUser.trim();
  }

  return 'user_default';
}

/**
 * Computes SHA-256 hex digest for passcode comparison.
 */
export async function hashPasscode(passcode: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time comparison for hex digest strings.
 */
export function timingSafeHashMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
