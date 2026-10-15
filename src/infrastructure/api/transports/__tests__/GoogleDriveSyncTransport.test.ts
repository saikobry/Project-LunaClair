import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDriveSyncTransport } from '../GoogleDriveSyncTransport';
import type {
  GoogleDrivePort,
  DriveFileMetadata,
  DriveChangesResponse,
  CursorRecoveryResult,
  UploadFileParams,
} from '../../../../domain/drive/models/drive.types';
import { DriveHttpError } from '../../../../domain/drive/models/drive.types';
import type { GoogleAuthPort, GoogleAuthSession } from '../../../../domain/auth/models/auth.types';
import type { SessionCredentials, SyncPushRequest } from '../../../../domain/sync/models/sync.types';
import { createHlc } from '../../../../domain/sync/utils/hlc';

describe('Infrastructure: GoogleDriveSyncTransport', () => {
  const credentials: SessionCredentials = {
    userId: 'user-sub-123',
    deviceId: 'dev-client-1',
    token: 'auth-token-xyz',
  };

  let mockDriveClient: GoogleDrivePort;
  let mockAuthService: GoogleAuthPort;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockAuthService = {
      login: vi.fn(),
      logout: vi.fn(),
      getValidAccessToken: vi.fn(async () => 'valid-access-token-999'),
      getSession: vi.fn(() => null as GoogleAuthSession | null),
      getStatus: vi.fn(() => 'authenticated' as const),
      subscribe: vi.fn(() => () => {}),
    };

    mockDriveClient = {
      generateFileId: vi.fn(async () => 'gen-id-1'),
      uploadFile: vi.fn(async (params: UploadFileParams) => ({
        id: params.fileId ?? 'uploaded-file-1',
        name: params.name,
        appProperties: params.appProperties,
      })),
      downloadFile: vi.fn(async () => '{}'),
      downloadBinary: vi.fn(async () => new Uint8Array()),
      deleteFile: vi.fn(async () => {}),
      listFiles: vi.fn(async () => []),
      getStartPageToken: vi.fn(async () => 'start-token-100'),
      listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'start-token-101' })),
      recover410Cursor: vi.fn(async () => ({
        newPageToken: 'recovered-start-token',
        missingFiles: [],
      })),
      uploadCompressedJson: vi.fn(async (name, _data, appProperties) => ({
        id: 'uploaded-journal-id-1',
        name,
        appProperties,
      })),
      downloadCompressedJson: vi.fn(async () => ({
        hlc: '2026-10-15T12:00:00.000Z_0000_peer-1',
        deviceId: 'peer-1',
        createdAt: '2026-10-15T12:00:00.000Z',
        mutations: [],
      })) as unknown as GoogleDrivePort['downloadCompressedJson'],
      recoverFromInvalidPageToken: vi.fn(async () => ({
        newPageToken: 'recovered-start-token',
        missingFiles: [],
      })),
    };
  });

  describe('push()', () => {
    it('uploads compressed journal with appProperties and returns accepted mutations', async () => {
      const fixedTime = new Date('2026-10-15T12:00:00.000Z');
      const hlc = createHlc(credentials.deviceId, () => fixedTime);
      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
        hlc,
      });

      const pushRequest: SyncPushRequest = {
        deviceId: credentials.deviceId,
        mutations: [
          {
            clientMutationId: 'mut-1',
            entityType: 'document',
            entityId: 'doc-123',
            operation: 'UPSERT',
            baseVersion: 2,
            clientTimestamp: '2026-10-15T12:00:00.000Z',
            payload: { title: 'Updated Document' },
          },
          {
            clientMutationId: 'mut-2',
            entityType: 'highlight',
            entityId: 'hl-456',
            operation: 'UPSERT',
            baseVersion: 0,
            clientTimestamp: '2026-10-15T12:00:00.000Z',
            payload: { color: 'yellow' },
          },
        ],
      };

      const response = await transport.push(credentials, pushRequest);

      expect(mockAuthService.getValidAccessToken).toHaveBeenCalledTimes(1);
      expect(mockDriveClient.uploadCompressedJson).toHaveBeenCalledTimes(1);

      const [name, payload, appProps, token, parents] = vi.mocked(
        mockDriveClient.uploadCompressedJson!
      ).mock.calls[0]!;

      expect(name).toBe('journal_2026-10-15T12:00:00.000Z_0000_dev-client-1.json.gz');
      expect((payload as { mutations: unknown[] }).mutations).toHaveLength(2);
      expect(appProps).toEqual({
        type: 'journal',
        deviceId: 'dev-client-1',
        hlc: '2026-10-15T12:00:00.000Z_0000_dev-client-1',
        seq: '1',
        count: '2',
      });
      expect(token).toBe('valid-access-token-999');
      expect(parents).toEqual(['appDataFolder']);

      expect(response.accepted).toEqual([
        {
          clientMutationId: 'mut-1',
          entityType: 'document',
          entityId: 'doc-123',
          newVersion: 3,
        },
        {
          clientMutationId: 'mut-2',
          entityType: 'highlight',
          entityId: 'hl-456',
          newVersion: 1,
        },
      ]);
      expect(response.conflicts).toEqual([]);
      expect(response.rejected).toEqual([]);

      // Pushed journal file id is registered as applied
      expect(transport.getAppliedFileIds().has('uploaded-journal-id-1')).toBe(true);
    });

    it('returns empty result immediately when mutations array is empty without calling Drive API', async () => {
      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      const response = await transport.push(credentials, {
        deviceId: credentials.deviceId,
        mutations: [],
      });

      expect(response).toEqual({
        accepted: [],
        conflicts: [],
        rejected: [],
      });
      expect(mockDriveClient.uploadCompressedJson).not.toHaveBeenCalled();
      expect(mockAuthService.getValidAccessToken).not.toHaveBeenCalled();
    });

    it('falls back to uploadFile when uploadCompressedJson is not implemented on driveClient', async () => {
      delete mockDriveClient.uploadCompressedJson;
      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      const response = await transport.push(credentials, {
        deviceId: credentials.deviceId,
        mutations: [
          {
            clientMutationId: 'm-1',
            entityType: 'document',
            entityId: 'doc-1',
            operation: 'UPSERT',
            clientTimestamp: '2026-10-15T12:00:00.000Z',
            payload: {},
          },
        ],
      });

      expect(mockDriveClient.uploadFile).toHaveBeenCalledTimes(1);
      const uploadParams = vi.mocked(mockDriveClient.uploadFile).mock.calls[0]![0];
      expect(uploadParams.name).toContain('journal_');
      expect(uploadParams.compress).toBe(true);
      expect(uploadParams.parents).toEqual(['appDataFolder']);
      expect(response.accepted).toHaveLength(1);
    });

    it('aborts when signal is already cancelled', async () => {
      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      const controller = new AbortController();
      controller.abort();

      await expect(
        transport.push(
          credentials,
          {
            deviceId: credentials.deviceId,
            mutations: [
              {
                clientMutationId: 'm-1',
                entityType: 'document',
                entityId: 'doc-1',
                operation: 'UPSERT',
                clientTimestamp: '2026-10-15T12:00:00.000Z',
                payload: {},
              },
            ],
          },
          controller.signal
        )
      ).rejects.toThrow();
    });
  });

  describe('pull()', () => {
    it('initializes pageToken with getStartPageToken and downloads newly added journals', async () => {
      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      const remoteMetadata: DriveFileMetadata = {
        id: 'journal-file-peer-1',
        name: 'journal_2026-10-15T12:05:00.000Z_0000_peer-dev.json.gz',
        appProperties: {
          type: 'journal',
          deviceId: 'peer-dev',
          hlc: '2026-10-15T12:05:00.000Z_0000_peer-dev',
          count: '1',
        },
      };

      const changesFeed: DriveChangesResponse = {
        changes: [
          {
            fileId: 'journal-file-peer-1',
            removed: false,
            file: remoteMetadata,
          },
        ],
        newStartPageToken: 'token-after-pull',
      };

      vi.mocked(mockDriveClient.listChanges).mockResolvedValueOnce(changesFeed);

      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValueOnce({
        hlc: '2026-10-15T12:05:00.000Z_0000_peer-dev',
        deviceId: 'peer-dev',
        createdAt: '2026-10-15T12:05:00.000Z',
        mutations: [
          {
            clientMutationId: 'peer-mut-1',
            entityType: 'document',
            entityId: 'doc-shared',
            operation: 'UPSERT',
            baseVersion: 1,
            clientTimestamp: '2026-10-15T12:05:00.000Z',
            payload: { title: 'Peer Shared Note' },
          },
        ],
      });

      const pullResponse = await transport.pull(credentials, 0);

      expect(mockDriveClient.getStartPageToken).toHaveBeenCalledTimes(1);
      expect(mockDriveClient.listChanges).toHaveBeenCalledWith(
        'start-token-100',
        'valid-access-token-999'
      );
      expect(mockDriveClient.downloadCompressedJson).toHaveBeenCalledWith(
        'journal-file-peer-1',
        'valid-access-token-999'
      );

      expect(pullResponse.newCursor).toBe(1);
      expect(pullResponse.hasMore).toBe(false);
      expect(pullResponse.changes).toHaveLength(1);
      expect(pullResponse.changes[0]).toEqual({
        sequence: 1,
        entityType: 'document',
        entityId: 'doc-shared',
        operation: 'UPSERT',
        version: 1,
        changedAt: '2026-10-15T12:05:00.000Z',
        data: { title: 'Peer Shared Note' },
      });

      // Peer watermark must be updated
      expect(transport.getPeerWatermarks()['peer-dev']).toBe(
        '2026-10-15T12:05:00.000Z_0000_peer-dev'
      );
      // Cached pageToken must advance to newStartPageToken
      expect(transport.getPageToken(credentials.userId, credentials.deviceId)).toBe(
        'token-after-pull'
      );
    });

    it('skips already applied files and ignores removed or non-journal files', async () => {
      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      // Pre-seed an applied file
      transport.setPageToken(credentials.userId, credentials.deviceId, 'existing-token');

      const changesFeed: DriveChangesResponse = {
        changes: [
          {
            fileId: 'snapshot-file-1',
            removed: false,
            file: {
              id: 'snapshot-file-1',
              name: 'snapshot_1.json.gz',
              appProperties: { type: 'snapshot' },
            },
          },
          {
            fileId: 'removed-journal-file',
            removed: true,
          },
        ],
        newStartPageToken: 'token-after-ignore',
      };

      vi.mocked(mockDriveClient.listChanges).mockResolvedValueOnce(changesFeed);

      const pullResponse = await transport.pull(credentials, 10);

      expect(mockDriveClient.getStartPageToken).not.toHaveBeenCalled();
      expect(mockDriveClient.downloadCompressedJson).not.toHaveBeenCalled();
      expect(pullResponse.changes).toHaveLength(0);
      expect(pullResponse.newCursor).toBe(10);
      expect(pullResponse.hasMore).toBe(false);
    });

    it('falls back to downloadFile with decompress when downloadCompressedJson is absent', async () => {
      delete mockDriveClient.downloadCompressedJson;
      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      const remoteMetadata: DriveFileMetadata = {
        id: 'journal-file-raw',
        name: 'journal_raw.json.gz',
        appProperties: { type: 'journal' },
      };

      vi.mocked(mockDriveClient.listChanges).mockResolvedValueOnce({
        changes: [{ fileId: 'journal-file-raw', file: remoteMetadata }],
        newStartPageToken: 'next-raw-token',
      });

      vi.mocked(mockDriveClient.downloadFile).mockResolvedValueOnce(
        JSON.stringify({
          hlc: '2026-10-15T12:00:00.000Z_0000_dev2',
          deviceId: 'dev2',
          mutations: [
            {
              clientMutationId: 'raw-mut-1',
              entityType: 'highlight',
              entityId: 'hl-1',
              operation: 'DELETE',
              clientTimestamp: '2026-10-15T12:00:00.000Z',
              payload: null,
            },
          ],
        })
      );

      const pullResponse = await transport.pull(credentials, 5);

      expect(mockDriveClient.downloadFile).toHaveBeenCalledWith(
        'journal-file-raw',
        'valid-access-token-999',
        { decompress: true }
      );
      expect(pullResponse.changes).toHaveLength(1);
      expect(pullResponse.changes[0]?.operation).toBe('DELETE');
      expect(pullResponse.newCursor).toBe(6);
    });
  });

  describe('pull() 410 cursor invalidation recovery', () => {
    it('recovers cleanly from 410 invalid page token and processes missingFiles', async () => {
      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      transport.setPageToken(credentials.userId, credentials.deviceId, 'stale-token-410');

      // Simulate DriveHttpError 410 Gone / Invalid page token
      const error410 = new DriveHttpError(
        'Invalid page token: token has expired or is invalid',
        410,
        'Gone'
      );
      vi.mocked(mockDriveClient.listChanges).mockRejectedValueOnce(error410);

      const missingFileMeta: DriveFileMetadata = {
        id: 'missing-journal-1',
        name: 'journal_recovered.json.gz',
        appProperties: {
          type: 'journal',
          deviceId: 'remote-peer-3',
          hlc: '2026-10-15T12:20:00.000Z_0000_remote-peer-3',
        },
      };

      const recoveryResult: CursorRecoveryResult = {
        newPageToken: 'fresh-recovery-token-777',
        missingFiles: [missingFileMeta],
      };

      vi.mocked(mockDriveClient.recoverFromInvalidPageToken!).mockResolvedValueOnce(recoveryResult);

      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValueOnce({
        hlc: '2026-10-15T12:20:00.000Z_0000_remote-peer-3',
        deviceId: 'remote-peer-3',
        createdAt: '2026-10-15T12:20:00.000Z',
        mutations: [
          {
            clientMutationId: 'recovered-mut-1',
            entityType: 'flashcardReview',
            entityId: 'q:123',
            operation: 'UPSERT',
            clientTimestamp: '2026-10-15T12:20:00.000Z',
            payload: { repetitions: 2 },
          },
        ],
      });

      const response = await transport.pull(credentials, 15);

      expect(mockDriveClient.recoverFromInvalidPageToken).toHaveBeenCalledTimes(1);
      expect(transport.getPageToken(credentials.userId, credentials.deviceId)).toBe(
        'fresh-recovery-token-777'
      );

      expect(response.changes).toHaveLength(1);
      expect(response.changes[0]?.entityType).toBe('flashcardReview');
      expect(response.changes[0]?.sequence).toBe(16);
      expect(response.newCursor).toBe(16);
      expect(response.hasMore).toBe(false);
    });

    it('re-throws non-410 HTTP errors without recovery', async () => {
      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      const error500 = new DriveHttpError('Internal Server Error', 500, 'ServerError');
      vi.mocked(mockDriveClient.listChanges).mockRejectedValueOnce(error500);

      await expect(transport.pull(credentials, 0)).rejects.toThrow('Internal Server Error');
      expect(mockDriveClient.recoverFromInvalidPageToken).not.toHaveBeenCalled();
    });
  });
});
