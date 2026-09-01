import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ShareHttpError,
  ShareNetworkError,
  WorkerShareTransport,
} from '../WorkerShareTransport';
import type { StudyPackage } from '../../../domain/package/package.types';

describe('WorkerShareTransport', () => {
  const mockPackage: StudyPackage = {
    format: 'lcpack',
    schemaVersion: 1,
    metadata: {
      title: 'Test Package',
      createdAt: '2026-08-28T00:00:00.000Z',
    },
    materials: [
      {
        id: 'pkg_mat_1',
        title: 'Material 1',
        documentContent: 'Content 1',
      },
    ],
    questions: [],
    quizzes: [],
  };

  let mockFetch: ReturnType<typeof vi.fn>;
  let transport: WorkerShareTransport;

  beforeEach(() => {
    mockFetch = vi.fn();
    transport = new WorkerShareTransport('https://api.project-lunaclair.workers.dev/api', mockFetch as unknown as typeof fetch);
  });

  describe('publish', () => {
    it('publishes a package successfully via POST /api/shares', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'share_123',
          format: 'lcpack',
          schemaVersion: 1,
          title: 'Test Package',
          accessType: 'public',
          shareUrl: '/share/share_123',
          createdAt: '2026-08-28T00:00:00.000Z',
        }),
      });

      const result = await transport.publish(mockPackage, {
        accessType: 'public',
        authToken: 'token_abc',
        userId: 'user_1',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.project-lunaclair.workers.dev/api/shares');
      expect(options.method).toBe('POST');
      expect(options.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token_abc',
        'x-user-id': 'user_1',
      });
      expect(result.id).toBe('share_123');
      expect(result.shareUrl).toBe('/share/share_123');
    });

    it('throws ShareHttpError when publish returns non-200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: async () => ({ error: 'Validation failed' }),
      });

      await expect(transport.publish(mockPackage)).rejects.toThrow(ShareHttpError);
    });
  });

  describe('fetch', () => {
    it('fetches published share successfully via GET /api/shares/:id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'share_123',
          format: 'lcpack',
          schemaVersion: 1,
          title: 'Test Package',
          accessType: 'passcode',
          package: mockPackage,
          createdAt: '2026-08-28T00:00:00.000Z',
          updatedAt: '2026-08-28T00:00:00.000Z',
          viewCount: 1,
          downloadCount: 0,
        }),
      });

      const result = await transport.fetch('share_123', 'secret');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.project-lunaclair.workers.dev/api/shares/share_123',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'X-Share-Passcode': 'secret',
          },
        }),
      );
      expect(result.id).toBe('share_123');
      expect(result.package.materials.length).toBe(1);
    });

    it('wraps fetch network rejections in ShareNetworkError', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(transport.fetch('share_123')).rejects.toThrow(ShareNetworkError);
    });
  });

  describe('trackDownload', () => {
    it('increments download count via POST /api/shares/:id/download', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, downloadCount: 5 }),
      });

      const result = await transport.trackDownload('share_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.project-lunaclair.workers.dev/api/shares/share_123/download',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(result.downloadCount).toBe(5);
    });
  });

  describe('delete', () => {
    it('deletes share via DELETE /api/shares/:id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await transport.delete('share_123', 'auth_token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.project-lunaclair.workers.dev/api/shares/share_123',
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer auth_token',
          },
        }),
      );
    });
  });
});
