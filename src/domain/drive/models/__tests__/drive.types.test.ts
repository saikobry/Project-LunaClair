import { describe, it, expect } from 'vitest';
import {
  DriveHttpError,
  DriveAuthError,
  DriveQuotaExceededError,
  DriveRateLimitError,
  type DriveFileMetadata,
  type DriveChangeItem,
  type DriveChangesResponse,
  type CursorRecoveryResult,
  type UploadFileParams,
  type Recover410Params,
  type GoogleDrivePort,
} from '../drive.types';

describe('Domain: drive.types contracts', () => {
  describe('Error classes hierarchy and properties', () => {
    it('instantiates DriveHttpError with status, statusText, and details', () => {
      const details = { error: { code: 500, message: 'Internal Server Error' } };
      const err = new DriveHttpError('Request failed', 500, 'Internal Server Error', details);

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(DriveHttpError);
      expect(err.name).toBe('DriveHttpError');
      expect(err.status).toBe(500);
      expect(err.statusText).toBe('Internal Server Error');
      expect(err.details).toEqual(details);
      expect(err.message).toBe('Request failed');
    });

    it('instantiates DriveAuthError with 401 status and correct defaults', () => {
      const err = new DriveAuthError();

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(DriveHttpError);
      expect(err).toBeInstanceOf(DriveAuthError);
      expect(err.name).toBe('DriveAuthError');
      expect(err.status).toBe(401);
      expect(err.statusText).toBe('Unauthorized');
      expect(err.message).toBe('Google Drive authentication failed or token expired');

      const customErr = new DriveAuthError('Custom auth error', { reason: 'invalid_token' });
      expect(customErr.message).toBe('Custom auth error');
      expect(customErr.details).toEqual({ reason: 'invalid_token' });
    });

    it('instantiates DriveQuotaExceededError with 403 status', () => {
      const details = { error: { errors: [{ reason: 'storageQuotaExceeded' }] } };
      const err = new DriveQuotaExceededError('Quota exceeded', details);

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(DriveHttpError);
      expect(err).toBeInstanceOf(DriveQuotaExceededError);
      expect(err.name).toBe('DriveQuotaExceededError');
      expect(err.status).toBe(403);
      expect(err.statusText).toBe('Forbidden');
      expect(err.message).toBe('Quota exceeded');
      expect(err.details).toEqual(details);
    });

    it('instantiates DriveRateLimitError with 429 status and retryAfterSeconds', () => {
      const details = { error: { message: 'Too many requests' } };
      const err = new DriveRateLimitError('Rate limited', 30, details);

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(DriveHttpError);
      expect(err).toBeInstanceOf(DriveRateLimitError);
      expect(err.name).toBe('DriveRateLimitError');
      expect(err.status).toBe(429);
      expect(err.statusText).toBe('Too Many Requests');
      expect(err.retryAfterSeconds).toBe(30);
      expect(err.message).toBe('Rate limited');
      expect(err.details).toEqual(details);
    });
  });

  describe('Contract shapes and GoogleDrivePort', () => {
    it('shapes valid DriveFileMetadata', () => {
      const meta: DriveFileMetadata = {
        id: 'file-123',
        name: 'journal_2026-10-15_dev1.json.gz',
        appProperties: {
          hlc: '2026-10-15T12:00:00.000Z_0001_dev1',
          deviceId: 'dev1',
        },
        size: '1024',
        createdTime: '2026-10-15T12:00:00.000Z',
        mimeType: 'application/gzip',
        trashed: false,
      };

      expect(meta.id).toBe('file-123');
      expect(meta.appProperties?.deviceId).toBe('dev1');
      expect(meta.mimeType).toBe('application/gzip');
    });

    it('shapes valid DriveChangesResponse and DriveChangeItem', () => {
      const changeItem: DriveChangeItem = {
        fileId: 'file-123',
        removed: false,
        file: {
          id: 'file-123',
          name: 'journal_1.json.gz',
          appProperties: { hlc: 'hlc-val' },
        },
      };

      const changesResponse: DriveChangesResponse = {
        changes: [changeItem],
        nextPageToken: 'next_page_token',
        newStartPageToken: 'new_start_token',
      };

      expect(changesResponse.changes).toHaveLength(1);
      expect(changesResponse.changes[0]?.fileId).toBe('file-123');
      expect(changesResponse.nextPageToken).toBe('next_page_token');
    });

    it('shapes valid CursorRecoveryResult and Recover410Params', () => {
      const params: Recover410Params = {
        accessToken: 'access_token_123',
        appliedFileIds: new Set(['file-1']),
        peerWatermarks: { dev1: 'hlc-100' },
      };

      const result: CursorRecoveryResult = {
        newPageToken: 'start_token_789',
        missingFiles: [
          {
            id: 'file-2',
            name: 'journal_2.json.gz',
            appProperties: { deviceId: 'dev1', hlc: 'hlc-200' },
          },
        ],
      };

      expect(params.accessToken).toBe('access_token_123');
      expect(result.newPageToken).toBe('start_token_789');
      expect(result.missingFiles).toHaveLength(1);
      expect(result.missingFiles[0]?.id).toBe('file-2');
    });

    it('satisfies GoogleDrivePort structural interface contract', () => {
      const dummyPort: GoogleDrivePort = {
        generateFileId: async () => 'mock-file-id',
        uploadFile: async (params: UploadFileParams) => ({
          id: params.fileId ?? 'uploaded-id',
          name: params.name,
        }),
        downloadFile: async () => '{"test": true}',
        downloadBinary: async () => new Uint8Array([1, 2, 3]),
        deleteFile: async () => {},
        listFiles: async () => [],
        getStartPageToken: async () => 'start-token',
        listChanges: async () => ({ changes: [] }),
        recover410Cursor: async () => ({ newPageToken: 'new-token', missingFiles: [] }),
      };

      expect(typeof dummyPort.generateFileId).toBe('function');
      expect(typeof dummyPort.uploadFile).toBe('function');
      expect(typeof dummyPort.downloadFile).toBe('function');
      expect(typeof dummyPort.downloadBinary).toBe('function');
      expect(typeof dummyPort.deleteFile).toBe('function');
      expect(typeof dummyPort.listFiles).toBe('function');
      expect(typeof dummyPort.getStartPageToken).toBe('function');
      expect(typeof dummyPort.listChanges).toBe('function');
      expect(typeof dummyPort.recover410Cursor).toBe('function');
    });
  });
});
