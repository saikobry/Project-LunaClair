import { describe, expect, it } from 'vitest';
import { computeCorsHeaders, handleCorsPreflight } from '../cors';
import { decodeSegment, toUint8Array } from '../path';
import {
  badRequest,
  binary,
  conflict,
  forbidden,
  json,
  methodNotAllowed,
  noContent,
  notFound,
  payloadTooLarge,
  serverError,
  unauthorized,
} from '../responses';
import {
  extractBearerToken,
  hashPasscode,
  resolveUserId,
  timingSafeHashMatch,
  tokensMatch,
} from '../security';
import type { Env } from '../types';

describe('Worker Core Primitives', () => {
  const dummyEnv: Env = {
    DB: {} as D1Database,
    CORS_ORIGINS: 'https://lunaclair.app, https://dev.lunaclair.app',
    SEED_TOKEN: 'secret123',
  };

  describe('CORS Primitives', () => {
    it('computes CORS headers for allowed origin', () => {
      const req = new Request('https://api.test/api/catalog', {
        headers: { Origin: 'https://lunaclair.app' },
      });
      const headers = computeCorsHeaders(req, dummyEnv);
      expect(headers['access-control-allow-origin']).toBe('https://lunaclair.app');
      expect(headers['access-control-allow-methods']).toContain('POST');
      expect(headers['access-control-allow-headers']).toContain('x-share-passcode');
    });

    it('falls back to wildcard when origin is not in allowlist', () => {
      const req = new Request('https://api.test/api/catalog', {
        headers: { Origin: 'https://malicious.com' },
      });
      const headers = computeCorsHeaders(req, dummyEnv);
      expect(headers['access-control-allow-origin']).toBe('*');
    });

    it('handles CORS OPTIONS preflight request', () => {
      const req = new Request('https://api.test/api/catalog', {
        method: 'OPTIONS',
        headers: { Origin: 'https://lunaclair.app' },
      });
      const preflight = handleCorsPreflight(req, dummyEnv);
      expect(preflight).not.toBeNull();
      expect(preflight?.status).toBe(204);
      expect(preflight?.headers.get('access-control-allow-origin')).toBe('https://lunaclair.app');
    });

    it('returns null for non-OPTIONS requests', () => {
      const req = new Request('https://api.test/api/catalog', { method: 'GET' });
      expect(handleCorsPreflight(req, dummyEnv)).toBeNull();
    });
  });

  describe('Response Helpers', () => {
    it('constructs json responses with appropriate headers', async () => {
      const res = json({ hello: 'world' }, 201, { 'x-custom': 'header' });
      expect(res.status).toBe(201);
      expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
      expect(res.headers.get('x-custom')).toBe('header');
      expect(await res.json()).toEqual({ hello: 'world' });
    });

    it('constructs binary responses', async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const res = binary(data, 'image/png', { 'cache-control': 'public' });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
      expect(res.headers.get('cache-control')).toBe('public');
      const buf = await res.arrayBuffer();
      expect(new Uint8Array(buf)).toEqual(data);
    });

    it('constructs standard error responses', async () => {
      const br = badRequest('Custom error');
      expect(br.status).toBe(400);
      expect(await br.json()).toEqual({ error: 'Custom error' });

      const un = unauthorized();
      expect(un.status).toBe(401);
      expect(await un.json()).toEqual({ error: 'Unauthorized' });

      const fb = forbidden();
      expect(fb.status).toBe(403);
      expect(await fb.json()).toEqual({ error: 'Forbidden' });

      const nf = notFound();
      expect(nf.status).toBe(404);
      expect(await nf.json()).toEqual({ error: 'Not found' });

      const mna = methodNotAllowed({}, ['GET', 'POST']);
      expect(mna.status).toBe(405);
      expect(mna.headers.get('allow')).toBe('GET, POST');
      expect(await mna.json()).toEqual({ error: 'Method not allowed' });

      const cf = conflict('Version conflict');
      expect(cf.status).toBe(409);
      expect(await cf.json()).toEqual({ error: 'Version conflict' });

      const ptl = payloadTooLarge();
      expect(ptl.status).toBe(413);
      expect(await ptl.json()).toEqual({ error: 'Payload too large' });

      const se = serverError();
      expect(se.status).toBe(500);
      expect(await se.json()).toEqual({ error: 'Internal server error' });

      const nc = noContent();
      expect(nc.status).toBe(204);
      expect(await nc.text()).toBe('');
    });
  });

  describe('Security Primitives', () => {
    it('compares tokens in constant time', async () => {
      expect(await tokensMatch('secret123', 'secret123')).toBe(true);
      expect(await tokensMatch('secret123', 'wrong')).toBe(false);
      expect(await tokensMatch('secret123', undefined)).toBe(false);
      expect(await tokensMatch(undefined, 'secret123')).toBe(false);
    });

    it('extracts bearer tokens', () => {
      const reqWithBearer = new Request('https://api.test', {
        headers: { Authorization: 'Bearer my-token-123' },
      });
      expect(extractBearerToken(reqWithBearer)).toBe('my-token-123');

      const reqNoBearer = new Request('https://api.test', {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      });
      expect(extractBearerToken(reqNoBearer)).toBeUndefined();

      const reqNoHeader = new Request('https://api.test');
      expect(extractBearerToken(reqNoHeader)).toBeUndefined();
    });

    it('resolves userId from JWT bearer claims, raw token, or fallback headers', () => {
      // JWT with sub
      const jwtPayload = btoa(JSON.stringify({ sub: 'user_jwt_123' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const jwt = `header.${jwtPayload}.sig`;
      const jwtReq = new Request('https://api.test', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(resolveUserId(jwtReq)).toBe('user_jwt_123');

      // Raw token
      const rawReq = new Request('https://api.test', {
        headers: { Authorization: 'Bearer custom-token' },
      });
      expect(resolveUserId(rawReq)).toBe('custom-token');

      // x-user-id fallback
      const headerReq = new Request('https://api.test', {
        headers: { 'x-user-id': 'custom_user_id' },
      });
      expect(resolveUserId(headerReq)).toBe('custom_user_id');

      // default fallback
      const emptyReq = new Request('https://api.test');
      expect(resolveUserId(emptyReq)).toBe('user_default');
    });

    it('hashes passcodes and verifies with timing-safe comparison', async () => {
      const hash = await hashPasscode('my-secret-passcode');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hex length

      const sameHash = await hashPasscode('my-secret-passcode');
      expect(timingSafeHashMatch(hash, sameHash)).toBe(true);

      const differentHash = await hashPasscode('other-passcode');
      expect(timingSafeHashMatch(hash, differentHash)).toBe(false);
    });
  });

  describe('Path Primitives', () => {
    it('decodes clean segments', () => {
      expect(decodeSegment('normal-slug')).toBe('normal-slug');
      expect(decodeSegment('hello%20world')).toBe('hello world');
    });

    it('rejects path traversal attempts', () => {
      expect(decodeSegment('..')).toBeNull();
      expect(decodeSegment('foo/bar')).toBeNull();
      expect(decodeSegment('foo%2Fbar')).toBeNull();
      expect(decodeSegment('foo\\bar')).toBeNull();
      expect(decodeSegment('foo%5Cbar')).toBeNull();
    });

    it('handles malformed URI components gracefully', () => {
      expect(decodeSegment('%E0%A4%A')).toBeNull();
    });

    it('converts untyped data to Uint8Array', () => {
      const raw = [10, 20, 30];
      const converted = toUint8Array(raw);
      expect(converted).toBeInstanceOf(Uint8Array);
      expect(converted[0]).toBe(10);
      expect(converted[1]).toBe(20);
      expect(converted[2]).toBe(30);

      const buf = new ArrayBuffer(4);
      expect(toUint8Array(buf).byteLength).toBe(4);
      expect(toUint8Array(null).byteLength).toBe(0);
    });
  });
});
