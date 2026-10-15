import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GoogleDriveClient,
  gzipCompress,
  gzipDecompress,
} from '../GoogleDriveClient';
import {
  DriveAuthError,
  DriveQuotaExceededError,
  DriveRateLimitError,
  DriveHttpError,
} from '../../../../domain/drive/models/drive.types';

describe('Infrastructure: GoogleDriveClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('gzipCompress and gzipDecompress primitives', () => {
    it('round-trips string content through compression and decompression', async () => {
      const originalText = 'Hello Google Drive BYOS lock-free sync! 🚀';
      const compressed = await gzipCompress(originalText);

      expect(compressed).toBeInstanceOf(Uint8Array);
      expect(compressed.byteLength).toBeGreaterThan(0);

      const decompressedBytes = await gzipDecompress(compressed);
      const decompressedText = new TextDecoder().decode(decompressedBytes);
      expect(decompressedText).toBe(originalText);
    });

    it('round-trips raw binary Uint8Array through compression and decompression', async () => {
      const rawBytes = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
      const compressed = await gzipCompress(rawBytes);

      const decompressedBytes = await gzipDecompress(compressed);
      expect(decompressedBytes).toEqual(rawBytes);
    });
  });

  describe('Multipart upload with Gzip compression and appProperties', () => {
    it('uploads gzipped binary payload using multipart/related Blob and appProperties', async () => {
      let capturedUrl = '';
      let capturedInit: RequestInit | undefined;

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = url.toString();
        capturedInit = init;
        return new Response(
          JSON.stringify({
            id: 'gen-file-123',
            name: 'journal_2026-10-15_dev1.json.gz',
            appProperties: {
              deviceId: 'dev1',
              hlc: '2026-10-15T12:00:00.000Z_0001_dev1',
            },
            size: '128',
            createdTime: '2026-10-15T12:00:00.000Z',
            mimeType: 'application/gzip',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new GoogleDriveClient({ baseDelayMs: 0, fetch: mockFetch as typeof fetch });

      const payloadContent = JSON.stringify({ mutations: [{ entity: 'doc', id: '1' }] });
      const metadata = await client.uploadFile({
        name: 'journal_2026-10-15_dev1.json.gz',
        content: payloadContent,
        fileId: 'gen-file-123',
        appProperties: {
          deviceId: 'dev1',
          hlc: '2026-10-15T12:00:00.000Z_0001_dev1',
        },
        accessToken: 'access-token-abc',
      });

      expect(metadata.id).toBe('gen-file-123');
      expect(metadata.name).toBe('journal_2026-10-15_dev1.json.gz');
      expect(metadata.appProperties?.deviceId).toBe('dev1');

      // Verify endpoint and query params
      expect(capturedUrl).toContain('https://www.googleapis.com/upload/drive/v3/files');
      expect(capturedUrl).toContain('uploadType=multipart');
      expect(capturedUrl).toContain('fields=id,name,appProperties,size,createdTime,mimeType');

      // Verify headers
      expect(capturedInit?.method).toBe('POST');
      const headers = capturedInit?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer access-token-abc');
      expect(headers['Content-Type']).toMatch(/^multipart\/related; boundary=-------LunaClairBoundary/);

      // Verify body is a Blob
      const bodyBlob = capturedInit?.body as Blob;
      expect(bodyBlob).toBeInstanceOf(Blob);
      expect(bodyBlob.type).toContain('multipart/related');

      // Extract boundary and verify multipart construction
      const boundaryMatch = headers['Content-Type'].match(/boundary=([^\s;]+)/);
      const boundary = boundaryMatch?.[1];
      expect(boundary).toBeDefined();

      const arrayBuffer = await bodyBlob.arrayBuffer();
      const rawBytes = new Uint8Array(arrayBuffer);
      const rawText = new TextDecoder().decode(rawBytes);

      // Metadata part check
      expect(rawText).toContain(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`);
      expect(rawText).toContain('"parents":["appDataFolder"]');
      expect(rawText).toContain('"mimeType":"application/gzip"');
      expect(rawText).toContain('"id":"gen-file-123"');
      expect(rawText).toContain('"deviceId":"dev1"');

      // Media part header check
      expect(rawText).toContain(`--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`);
      expect(rawText).toContain(`\r\n--${boundary}--\r\n`);

      // Verify media part can be extracted and decompressed to original content
      const mediaHeaderMarker = `--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`;
      const closingMarker = `\r\n--${boundary}--\r\n`;

      const headerIndex = rawText.indexOf(mediaHeaderMarker);
      const contentStartIndex = headerIndex + new TextEncoder().encode(mediaHeaderMarker).byteLength;
      const closingIndex = rawText.indexOf(closingMarker);
      const compressedSlice = rawBytes.slice(contentStartIndex, closingIndex);

      const decompressedBytes = await gzipDecompress(compressedSlice);
      expect(new TextDecoder().decode(decompressedBytes)).toBe(payloadContent);
    });

    it('supports uncompressed upload when compress is false', async () => {
      let capturedInit: RequestInit | undefined;
      const mockFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        capturedInit = init;
        return new Response(
          JSON.stringify({ id: 'plain-file', name: 'plain.txt' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new GoogleDriveClient({ baseDelayMs: 0, fetch: mockFetch as typeof fetch });
      await client.uploadFile({
        name: 'plain.txt',
        content: 'plain text content',
        mimeType: 'text/plain',
        compress: false,
        accessToken: 'token-123',
      });

      const bodyBlob = capturedInit?.body as Blob;
      const bodyText = await bodyBlob.text();
      expect(bodyText).toContain('plain text content');
      expect(bodyText).toContain('Content-Type: text/plain');
    });
  });

  describe('Download and decompression via alt=media', () => {
    it('downloads and decompresses gzipped text content via alt=media', async () => {
      const originalContent = JSON.stringify({ deviceId: 'dev1', records: [1, 2, 3] });
      const compressedBytes = await gzipCompress(originalContent);

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        expect(url.toString()).toBe('https://www.googleapis.com/drive/v3/files/file-789?alt=media');
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer token-xyz');

        return new Response(compressedBytes as unknown as BodyInit, {
          status: 200,
          headers: { 'Content-Type': 'application/gzip' },
        });
      });

      const client = new GoogleDriveClient({ baseDelayMs: 0, fetch: mockFetch as typeof fetch });
      const text = await client.downloadFile('file-789', 'token-xyz');

      expect(text).toBe(originalContent);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('downloads binary Uint8Array content via downloadBinary', async () => {
      const originalBytes = new Uint8Array([5, 10, 15, 20]);
      const compressedBytes = await gzipCompress(originalBytes);

      const mockFetch = vi.fn(async () => {
        return new Response(compressedBytes as unknown as BodyInit, { status: 200 });
      });

      const client = new GoogleDriveClient({ baseDelayMs: 0, fetch: mockFetch as typeof fetch });
      const downloaded = await client.downloadBinary('file-bin', 'token-xyz');

      expect(downloaded).toEqual(originalBytes);
    });

    it('downloads without decompression when decompress: false', async () => {
      const rawText = 'uncompressed raw text';
      const mockFetch = vi.fn(async () => {
        return new Response(rawText, { status: 200 });
      });

      const client = new GoogleDriveClient({ baseDelayMs: 0, fetch: mockFetch as typeof fetch });
      const downloaded = await client.downloadFile('file-raw', 'token-xyz', { decompress: false });

      expect(downloaded).toBe(rawText);
    });
  });

  describe('Changes list consumption', () => {
    it('fetches incremental changes using pageToken and spaces=appDataFolder', async () => {
      let capturedUrl = '';
      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        capturedUrl = url.toString();
        return new Response(
          JSON.stringify({
            changes: [
              {
                fileId: 'file-1',
                removed: false,
                file: {
                  id: 'file-1',
                  name: 'journal_1.json.gz',
                  appProperties: { hlc: 'hlc-1', deviceId: 'dev1' },
                },
              },
              {
                fileId: 'file-2',
                removed: true,
              },
            ],
            nextPageToken: 'page-token-2',
            newStartPageToken: 'new-start-token',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new GoogleDriveClient({ baseDelayMs: 0, fetch: mockFetch as typeof fetch });
      const result = await client.listChanges('page-token-1', 'token-123');

      expect(capturedUrl).toContain('https://www.googleapis.com/drive/v3/changes');
      expect(capturedUrl).toContain('spaces=appDataFolder');
      expect(capturedUrl).toContain('pageToken=page-token-1');
      expect(capturedUrl).toContain('fields=newStartPageToken%2CnextPageToken%2Cchanges');

      expect(result.changes).toHaveLength(2);
      expect(result.changes[0]?.fileId).toBe('file-1');
      expect(result.changes[0]?.file?.appProperties?.deviceId).toBe('dev1');
      expect(result.changes[1]?.removed).toBe(true);
      expect(result.nextPageToken).toBe('page-token-2');
      expect(result.newStartPageToken).toBe('new-start-token');
    });
  });

  describe('4-Step 410 Cursor Recovery Protocol', () => {
    it('executes 4-step recovery: anchors startPageToken first, lists metadata, and diffs watermarks', async () => {
      const callLog: string[] = [];

      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();

        if (urlStr.includes('/changes/startPageToken')) {
          callLog.push('startPageToken');
          return new Response(
            JSON.stringify({ startPageToken: 'fresh_anchor_token_999' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (urlStr.includes('/drive/v3/files')) {
          callLog.push('files.list');
          return new Response(
            JSON.stringify({
              files: [
                {
                  id: 'file-applied',
                  name: 'journal_applied.json.gz',
                  appProperties: { deviceId: 'dev1', hlc: '2026-10-15T10:00:00.000Z_0001_dev1' },
                },
                {
                  id: 'file-older',
                  name: 'journal_older.json.gz',
                  appProperties: { deviceId: 'dev1', hlc: '2026-10-15T09:00:00.000Z_0001_dev1' },
                },
                {
                  id: 'file-newer',
                  name: 'journal_newer.json.gz',
                  appProperties: { deviceId: 'dev1', hlc: '2026-10-15T11:00:00.000Z_0001_dev1' },
                },
                {
                  id: 'file-new-device',
                  name: 'journal_dev2.json.gz',
                  appProperties: { deviceId: 'dev2', hlc: '2026-10-15T08:00:00.000Z_0001_dev2' },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response('Not Found', { status: 404 });
      });

      const client = new GoogleDriveClient({ baseDelayMs: 0, fetch: mockFetch as typeof fetch });

      const recovery = await client.recover410Cursor({
        accessToken: 'token-123',
        appliedFileIds: new Set(['file-applied']),
        peerWatermarks: {
          dev1: '2026-10-15T10:00:00.000Z_0001_dev1',
        },
      });

      // Step 1 check: startPageToken MUST be called BEFORE files.list
      expect(callLog).toEqual(['startPageToken', 'files.list']);

      // Step 4 check: Returns { newPageToken, missingFiles }
      expect(recovery.newPageToken).toBe('fresh_anchor_token_999');

      // Step 3 check: Filter results
      // - file-applied: excluded because in appliedFileIds
      // - file-older: excluded because hlc <= peerWatermark for dev1
      // - file-newer: INCLUDED because hlc > peerWatermark for dev1
      // - file-new-device: INCLUDED because dev2 has no existing watermark
      expect(recovery.missingFiles).toHaveLength(2);
      expect(recovery.missingFiles.map((f) => f.id)).toEqual(['file-newer', 'file-new-device']);
    });
  });

  describe('Quota & Rate Limit Discrimination', () => {
    it('throws DriveQuotaExceededError immediately on HTTP 403 storageQuotaExceeded with no retry', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: "The user's Drive storage quota has been exceeded.",
              errors: [
                {
                  domain: 'usageLimits',
                  reason: 'storageQuotaExceeded',
                  message: "The user's Drive storage quota has been exceeded.",
                },
              ],
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new GoogleDriveClient({ baseDelayMs: 0, fetch: mockFetch as typeof fetch });

      await expect(
        client.uploadFile({
          name: 'test.json.gz',
          content: 'data',
          accessToken: 'token-123',
        })
      ).rejects.toThrow(DriveQuotaExceededError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('retries on HTTP 429 and succeeds when transient', async () => {
      let callCount = 0;
      const mockFetch = vi.fn(async () => {
        callCount++;
        if (callCount < 3) {
          return new Response(
            JSON.stringify({
              error: { code: 429, message: 'Rate Limit Exceeded' },
            }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ startPageToken: 'token-success' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new GoogleDriveClient({
        baseDelayMs: 0,
        maxRetries: 3,
        fetch: mockFetch as typeof fetch,
      });

      const token = await client.getStartPageToken('token-123');
      expect(token).toBe('token-success');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws DriveRateLimitError when HTTP 429 persists beyond maxRetries', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error: { code: 429, message: 'Rate Limit Exceeded' },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '5',
            },
          }
        );
      });

      const client = new GoogleDriveClient({
        baseDelayMs: 0,
        maxRetries: 2,
        fetch: mockFetch as typeof fetch,
      });

      let thrownError: unknown;
      try {
        await client.getStartPageToken('token-123');
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(DriveRateLimitError);
      const rateLimitErr = thrownError as DriveRateLimitError;
      expect(rateLimitErr.status).toBe(429);
      expect(rateLimitErr.retryAfterSeconds).toBe(5);
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('retries on 403 userRateLimitExceeded and throws DriveRateLimitError when exhausted', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'User rate limit exceeded.',
              errors: [{ reason: 'userRateLimitExceeded' }],
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new GoogleDriveClient({
        baseDelayMs: 0,
        maxRetries: 1,
        fetch: mockFetch as typeof fetch,
      });

      await expect(client.getStartPageToken('token-123')).rejects.toThrow(DriveRateLimitError);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws DriveAuthError immediately on HTTP 401 without retrying', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error: { code: 401, message: 'Invalid Credentials' },
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new GoogleDriveClient({ baseDelayMs: 0, fetch: mockFetch as typeof fetch });

      await expect(client.getStartPageToken('expired-token')).rejects.toThrow(DriveAuthError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('retries on transient HTTP 5xx errors and succeeds', async () => {
      let callCount = 0;
      const mockFetch = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response('Internal Server Error', { status: 500 });
        }
        if (callCount === 2) {
          return new Response('Bad Gateway', { status: 502 });
        }
        return new Response(
          JSON.stringify({ startPageToken: 'token-recovered' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new GoogleDriveClient({
        baseDelayMs: 0,
        maxRetries: 3,
        fetch: mockFetch as typeof fetch,
      });

      const token = await client.getStartPageToken('token-123');
      expect(token).toBe('token-recovered');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('throws DriveHttpError on 404 or other non-transient status', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error: { code: 404, message: 'File not found' },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new GoogleDriveClient({ baseDelayMs: 0, fetch: mockFetch as typeof fetch });

      await expect(client.deleteFile('non-existent-id', 'token-123')).rejects.toThrow(DriveHttpError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('File operations: generateFileId and deleteFile', () => {
    it('generates a unique file ID via files.generateIds in appDataFolder space', async () => {
      let capturedUrl = '';
      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        capturedUrl = url.toString();
        return new Response(
          JSON.stringify({
            kind: 'drive#generatedIds',
            space: 'appDataFolder',
            ids: ['gen-id-alpha-42'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new GoogleDriveClient({ baseDelayMs: 0, fetch: mockFetch as typeof fetch });
      const id = await client.generateFileId('token-123');

      expect(id).toBe('gen-id-alpha-42');
      expect(capturedUrl).toBe('https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=appDataFolder');
    });

    it('deletes a file by ID via DELETE /drive/v3/files/{id}', async () => {
      let capturedUrl = '';
      let capturedMethod = '';

      const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = url.toString();
        capturedMethod = init?.method ?? '';
        return new Response(null, { status: 204 });
      });

      const client = new GoogleDriveClient({ baseDelayMs: 0, fetch: mockFetch as typeof fetch });
      await client.deleteFile('file-to-trash', 'token-123');

      expect(capturedUrl).toBe('https://www.googleapis.com/drive/v3/files/file-to-trash');
      expect(capturedMethod).toBe('DELETE');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
