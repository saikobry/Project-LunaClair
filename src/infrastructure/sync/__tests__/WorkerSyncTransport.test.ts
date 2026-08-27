import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SyncHttpError,
  SyncNetworkError,
  SyncProtocolError,
  type SessionCredentials,
  type SyncPullResponse,
  type SyncPushRequest,
  type SyncPushResponse,
} from '../../../domain/sync';
import { WorkerSyncTransport } from '../WorkerSyncTransport';

describe('WorkerSyncTransport', () => {
  const credentials: SessionCredentials = {
    userId: 'user-alice-1',
    deviceId: 'device-ipad-1',
    token: 'jwt-token-xyz',
  };

  const samplePushRequest: SyncPushRequest = {
    deviceId: 'device-ipad-1',
    mutations: [
      {
        clientMutationId: 'mut-1',
        entityType: 'document',
        entityId: 'doc-1',
        operation: 'UPSERT',
        baseVersion: 1,
        clientTimestamp: '2026-08-27T10:00:00.000Z',
        payload: { title: 'Updated Doc', content: '# Hello' },
      },
    ],
  };

  const validPushResponseBody: SyncPushResponse = {
    serverCursor: 42,
    accepted: [{ clientMutationId: 'mut-1', entityId: 'doc-1', newVersion: 2 }],
    conflicts: [],
    rejected: [],
  };

  const validPullResponseBody: SyncPullResponse = {
    newCursor: 45,
    hasMore: false,
    changes: [
      {
        sequence: 43,
        entityType: 'document',
        entityId: 'doc-1',
        operation: 'UPSERT',
        version: 2,
        changedAt: '2026-08-27T10:00:01.000Z',
        data: { title: 'Server Doc', content: '# Cloud Content' },
      },
      {
        sequence: 44,
        entityType: 'highlight',
        entityId: 'hl-1',
        operation: 'UPSERT',
        changedAt: '2026-08-27T10:00:02.000Z',
        data: { text: 'Key point', color: 'yellow' },
      },
    ],
  };

  let mockFetch: ReturnType<typeof vi.fn>;
  let transport: WorkerSyncTransport;

  beforeEach(() => {
    mockFetch = vi.fn();
    transport = new WorkerSyncTransport('https://api.lunaclair.com/api/', mockFetch as unknown as typeof fetch);
  });

  describe('constructor and URL normalization', () => {
    it('strips trailing slashes from baseUrl', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validPushResponseBody,
      });

      await transport.push(credentials, samplePushRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.lunaclair.com/api/sync/push',
        expect.anything()
      );
    });

    it('defaults baseUrl to /api when none is provided', async () => {
      const defaultTransport = new WorkerSyncTransport(undefined, mockFetch as unknown as typeof fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validPushResponseBody,
      });

      await defaultTransport.push(credentials, samplePushRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sync/push',
        expect.anything()
      );
    });
  });

  describe('push', () => {
    it('injects headers, serializes request body, and parses valid response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validPushResponseBody,
      });

      const abortController = new AbortController();
      const result = await transport.push(credentials, samplePushRequest, abortController.signal);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.lunaclair.com/api/sync/push');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Content-Type': 'application/json',
        'x-user-id': 'user-alice-1',
        Authorization: 'Bearer jwt-token-xyz',
      });
      expect(options.signal).toBe(abortController.signal);
      expect(JSON.parse(options.body)).toEqual(samplePushRequest);

      expect(result).toEqual(validPushResponseBody);
    });

    it('maps network failures (fetch exceptions) to SyncNetworkError with isRetryable: true', async () => {
      const networkError = new TypeError('Failed to fetch');
      mockFetch.mockRejectedValue(networkError);

      try {
        await transport.push(credentials, samplePushRequest);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(SyncNetworkError);
        const syncErr = err as SyncNetworkError;
        expect(syncErr.isRetryable).toBe(true);
        expect(syncErr.cause).toBe(networkError);
        expect(syncErr.message).toContain('Failed to fetch');
      }
    });

    it('maps 400 Bad Request to non-retryable SyncHttpError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({ error: 'Missing deviceId' }),
      });

      try {
        await transport.push(credentials, samplePushRequest);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(SyncHttpError);
        const httpErr = err as SyncHttpError;
        expect(httpErr.status).toBe(400);
        expect(httpErr.isRetryable).toBe(false);
        expect(httpErr.responseBody).toEqual({ error: 'Missing deviceId' });
        expect(httpErr.message).toContain('Missing deviceId');
      }
    });

    it('maps 429 Rate Limit to retryable SyncHttpError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded',
      });

      try {
        await transport.push(credentials, samplePushRequest);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(SyncHttpError);
        const httpErr = err as SyncHttpError;
        expect(httpErr.status).toBe(429);
        expect(httpErr.isRetryable).toBe(true);
        expect(httpErr.responseBody).toBe('Rate limit exceeded');
      }
    });

    it('maps 500 Internal Server Error to retryable SyncHttpError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ error: 'D1 database locked' }),
      });

      try {
        await transport.push(credentials, samplePushRequest);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(SyncHttpError);
        const httpErr = err as SyncHttpError;
        expect(httpErr.status).toBe(500);
        expect(httpErr.isRetryable).toBe(true);
        expect(httpErr.responseBody).toEqual({ error: 'D1 database locked' });
      }
    });

    it('maps 503 Service Unavailable to retryable SyncHttpError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => 'Under maintenance',
      });

      try {
        await transport.push(credentials, samplePushRequest);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(SyncHttpError);
        const httpErr = err as SyncHttpError;
        expect(httpErr.status).toBe(503);
        expect(httpErr.isRetryable).toBe(true);
      }
    });

    it('throws SyncProtocolError on malformed JSON response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      });

      try {
        await transport.push(credentials, samplePushRequest);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(SyncProtocolError);
        const protoErr = err as SyncProtocolError;
        expect(protoErr.isRetryable).toBe(false);
        expect(protoErr.message).toContain('malformed JSON');
      }
    });

    it('throws SyncProtocolError when push response schema is missing serverCursor', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accepted: [],
          conflicts: [],
          rejected: [],
        }),
      });

      await expect(transport.push(credentials, samplePushRequest)).rejects.toThrow(SyncProtocolError);
    });

    it('throws SyncProtocolError when push response schema has invalid accepted items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          serverCursor: 1,
          accepted: [{ clientMutationId: 'm1' }], // missing entityId
          conflicts: [],
          rejected: [],
        }),
      });

      await expect(transport.push(credentials, samplePushRequest)).rejects.toThrow(SyncProtocolError);
    });

    it('throws SyncProtocolError when push response schema has invalid conflict items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          serverCursor: 1,
          accepted: [],
          conflicts: [{ clientMutationId: 'm1', entityId: 'doc-1' }], // missing serverVersion & serverPayload
          rejected: [],
        }),
      });

      await expect(transport.push(credentials, samplePushRequest)).rejects.toThrow(SyncProtocolError);
    });

    it('throws SyncProtocolError when push response schema has invalid rejected items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          serverCursor: 1,
          accepted: [],
          conflicts: [],
          rejected: [{ clientMutationId: 'm1' }], // missing reason
        }),
      });

      await expect(transport.push(credentials, samplePushRequest)).rejects.toThrow(SyncProtocolError);
    });
  });

  describe('pull', () => {
    it('constructs query URL, headers, and parses valid pull response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validPullResponseBody,
      });

      const abortController = new AbortController();
      const result = await transport.pull(credentials, 40, 50, abortController.signal);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.lunaclair.com/api/sync/pull?cursor=40&limit=50');
      expect(options.method).toBe('GET');
      expect(options.headers).toEqual({
        'x-user-id': 'user-alice-1',
        Authorization: 'Bearer jwt-token-xyz',
      });
      expect(options.signal).toBe(abortController.signal);

      expect(result).toEqual(validPullResponseBody);
    });

    it('uses default limit of 100 if not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validPullResponseBody,
      });

      await transport.pull(credentials, 0);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.lunaclair.com/api/sync/pull?cursor=0&limit=100');
    });

    it('maps network failures during pull to SyncNetworkError', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network disconnected'));

      try {
        await transport.pull(credentials, 0);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(SyncNetworkError);
        const netErr = err as SyncNetworkError;
        expect(netErr.isRetryable).toBe(true);
        expect(netErr.message).toContain('Network disconnected');
      }
    });

    it('maps 401 Unauthorized during pull to non-retryable SyncHttpError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ error: 'Token expired' }),
      });

      try {
        await transport.pull(credentials, 0);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(SyncHttpError);
        const httpErr = err as SyncHttpError;
        expect(httpErr.status).toBe(401);
        expect(httpErr.isRetryable).toBe(false);
      }
    });

    it('maps 502 Bad Gateway during pull to retryable SyncHttpError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        text: async () => 'Worker exception',
      });

      try {
        await transport.pull(credentials, 0);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(SyncHttpError);
        const httpErr = err as SyncHttpError;
        expect(httpErr.status).toBe(502);
        expect(httpErr.isRetryable).toBe(true);
      }
    });

    it('throws SyncProtocolError on invalid pull response schema missing newCursor', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hasMore: false,
          changes: [],
        }),
      });

      await expect(transport.pull(credentials, 0)).rejects.toThrow(SyncProtocolError);
    });

    it('throws SyncProtocolError when changes contains invalid entityType', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          newCursor: 10,
          hasMore: false,
          changes: [
            {
              sequence: 1,
              entityType: 'invalid_entity_type',
              entityId: 'id-1',
              operation: 'UPSERT',
              changedAt: '2026-08-27T10:00:00.000Z',
              data: {},
            },
          ],
        }),
      });

      await expect(transport.pull(credentials, 0)).rejects.toThrow(SyncProtocolError);
    });

    it('throws SyncProtocolError when changes contains invalid operation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          newCursor: 10,
          hasMore: false,
          changes: [
            {
              sequence: 1,
              entityType: 'document',
              entityId: 'doc-1',
              operation: 'INVALID_OP',
              changedAt: '2026-08-27T10:00:00.000Z',
              data: {},
            },
          ],
        }),
      });

      await expect(transport.pull(credentials, 0)).rejects.toThrow(SyncProtocolError);
    });

    it('throws SyncProtocolError when changes is not an array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          newCursor: 10,
          hasMore: false,
          changes: 'not-an-array',
        }),
      });

      await expect(transport.pull(credentials, 0)).rejects.toThrow(SyncProtocolError);
    });
  });
});
