import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { getActiveVaultDatabase } from '../../../database/schema/LunaClairDatabase';
import {
  GoogleDriveSyncTransport,
  MAX_PERSISTED_APPLIED_FILES,
} from '../GoogleDriveSyncTransport';
import type {
  GoogleDrivePort,
  DriveFileMetadata,
  DriveChangesResponse,
  CursorRecoveryResult,
  UploadFileParams,
} from '../../../../domain/drive/models/drive.types';
import { DriveHttpError } from '../../../../domain/drive/models/drive.types';
import type { GoogleAuthPort, GoogleAuthSession } from '../../../../domain/auth/models/auth.types';
import type { SessionCredentials, SyncPushRequest, SyncState } from '../../../../domain/sync/models/sync.types';
import type { SyncStateRepository } from '../../../../domain/sync/repositories/SyncStateRepository';
import { createHlc } from '../../../../domain/sync/utils/hlc';

describe('Infrastructure: GoogleDriveSyncTransport', () => {
  const credentials: SessionCredentials = {
    userId: 'user-sub-123',
    deviceId: 'dev-client-1',
    token: 'auth-token-xyz',
  };

  let mockDriveClient: GoogleDrivePort;
  let mockAuthService: GoogleAuthPort;

  beforeEach(async () => {
    vi.restoreAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    const activeDb = getActiveVaultDatabase();
    if (activeDb.isOpen()) {
      await Promise.all([
        activeDb.syncState.clear(),
        activeDb.documentContents.clear(),
        activeDb.highlights.clear(),
        activeDb.drawings.clear(),
        activeDb.flashcardReviews.clear(),
        activeDb.quizSessions.clear(),
      ]);
    }

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
    it('clean/first-time pull without cached pageToken calls getStartPageToken first, discovers existing journals, and downloads them', async () => {
      const callOrder: string[] = [];
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

      vi.mocked(mockDriveClient.getStartPageToken).mockImplementation(async () => {
        callOrder.push('getStartPageToken');
        return 'start-token-100';
      });

      vi.mocked(mockDriveClient.listFiles).mockImplementation(async () => {
        callOrder.push('listFiles');
        return [remoteMetadata];
      });

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

      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      const pullResponse = await transport.pull(credentials, 0);

      // Invariant: getStartPageToken at t0 MUST precede listFiles at t1
      expect(callOrder).toEqual(['getStartPageToken', 'listFiles']);
      expect(mockDriveClient.getStartPageToken).toHaveBeenCalledTimes(1);
      expect(mockDriveClient.listFiles).toHaveBeenCalledWith('valid-access-token-999');
      expect(mockDriveClient.listChanges).not.toHaveBeenCalled();
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
      // Cached pageToken must advance to newStartPageToken only after successful download
      expect(transport.getPageToken(credentials.userId, credentials.deviceId)).toBe(
        'start-token-100'
      );
      // Applied files must register hydrated journal
      expect(transport.getAppliedFileIds().has('journal-file-peer-1')).toBe(true);
    });

    it('does not commit candidateToken if hydration fails during journal download', async () => {
      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      const remoteMetadata: DriveFileMetadata = {
        id: 'journal-file-peer-fail',
        name: 'journal_2026-10-15T12:05:00.000Z_0000_peer-dev.json.gz',
        appProperties: {
          type: 'journal',
          deviceId: 'peer-dev',
          hlc: '2026-10-15T12:05:00.000Z_0000_peer-dev',
        },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValueOnce([remoteMetadata]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockRejectedValueOnce(
        new Error('Network disconnected during initial hydration')
      );

      await expect(transport.pull(credentials, 0)).rejects.toThrow(
        'Network disconnected during initial hydration'
      );

      // candidateToken must NOT be committed on failure
      expect(transport.getPageToken(credentials.userId, credentials.deviceId)).toBeUndefined();
    });

    it('subsequent pull with existing pageToken calls listChanges without calling listFiles', async () => {
      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      transport.setPageToken(credentials.userId, credentials.deviceId, 'existing-cached-token');

      const remoteMetadata: DriveFileMetadata = {
        id: 'journal-file-subsequent',
        name: 'journal_2026-10-15T12:10:00.000Z_0000_peer-dev.json.gz',
        appProperties: {
          type: 'journal',
          deviceId: 'peer-dev',
          hlc: '2026-10-15T12:10:00.000Z_0000_peer-dev',
          count: '1',
        },
      };

      const changesFeed: DriveChangesResponse = {
        changes: [
          {
            fileId: 'journal-file-subsequent',
            removed: false,
            file: remoteMetadata,
          },
        ],
        newStartPageToken: 'token-after-subsequent-pull',
      };

      vi.mocked(mockDriveClient.listChanges).mockResolvedValueOnce(changesFeed);

      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValueOnce({
        hlc: '2026-10-15T12:10:00.000Z_0000_peer-dev',
        deviceId: 'peer-dev',
        createdAt: '2026-10-15T12:10:00.000Z',
        mutations: [
          {
            clientMutationId: 'subsequent-mut-1',
            entityType: 'highlight',
            entityId: 'hl-subsequent',
            operation: 'UPSERT',
            baseVersion: 0,
            clientTimestamp: '2026-10-15T12:10:00.000Z',
            payload: { color: 'green' },
          },
        ],
      });

      const pullResponse = await transport.pull(credentials, 5);

      expect(mockDriveClient.getStartPageToken).not.toHaveBeenCalled();
      expect(mockDriveClient.listFiles).not.toHaveBeenCalled();
      expect(mockDriveClient.listChanges).toHaveBeenCalledWith(
        'existing-cached-token',
        'valid-access-token-999'
      );
      expect(mockDriveClient.downloadCompressedJson).toHaveBeenCalledWith(
        'journal-file-subsequent',
        'valid-access-token-999'
      );

      expect(pullResponse.newCursor).toBe(6);
      expect(pullResponse.changes).toHaveLength(1);
      expect(transport.getPageToken(credentials.userId, credentials.deviceId)).toBe(
        'token-after-subsequent-pull'
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

      transport.setPageToken(credentials.userId, credentials.deviceId, 'existing-fallback-token');

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

      transport.setPageToken(credentials.userId, credentials.deviceId, 'existing-active-token');

      const error500 = new DriveHttpError('Internal Server Error', 500, 'ServerError');
      vi.mocked(mockDriveClient.listChanges).mockRejectedValueOnce(error500);

      await expect(transport.pull(credentials, 0)).rejects.toThrow('Internal Server Error');
      expect(mockDriveClient.recoverFromInvalidPageToken).not.toHaveBeenCalled();
    });
  });

  describe('Transport state persistence in Dexie vault (syncState)', () => {
    it('persists pageTokens, appliedFileIds, and peerWatermarks to SyncStateRepository (Dexie vault) and restores them across instances without touching localStorage', async () => {
      const inMemorySyncStore = new Map<string, SyncState>();
      const mockStateRepo: SyncStateRepository = {
        getSyncState: vi.fn(async (key: string) => inMemorySyncStore.get(key) ?? null),
        saveSyncState: vi.fn(async (state: SyncState) => {
          inMemorySyncStore.set(state.key, { ...state });
        }),
      };

      const localStorageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
      const localStorageGetSpy = vi.spyOn(Storage.prototype, 'getItem');

      const transport1 = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
        stateRepo: mockStateRepo,
      });

      // 1. Push a mutation to generate an applied file ID
      await transport1.push(credentials, {
        deviceId: credentials.deviceId,
        mutations: [
          {
            clientMutationId: 'm-persisted-1',
            entityType: 'document',
            entityId: 'doc-persist',
            operation: 'UPSERT',
            clientTimestamp: '2026-10-15T12:00:00.000Z',
            payload: {},
          },
        ],
      });

      // 2. Perform initial hydration pull
      const remoteFile: DriveFileMetadata = {
        id: 'remote-journal-persist',
        name: 'journal_2026-10-15T12:00:00.000Z_0000_peer-persist.json.gz',
        appProperties: {
          type: 'journal',
          deviceId: 'peer-persist',
          hlc: '2026-10-15T12:00:00.000Z_0000_peer-persist',
        },
      };
      vi.mocked(mockDriveClient.listFiles).mockResolvedValueOnce([remoteFile]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValueOnce({
        hlc: '2026-10-15T12:00:00.000Z_0000_peer-persist',
        deviceId: 'peer-persist',
        createdAt: '2026-10-15T12:00:00.000Z',
        mutations: [],
      });

      await transport1.pull(credentials, 0);

      // Verify state was saved to SyncStateRepository
      const stateKey = `${credentials.userId}:${credentials.deviceId}`;
      expect(inMemorySyncStore.has(stateKey)).toBe(true);
      const savedState = inMemorySyncStore.get(stateKey)!;
      expect(savedState.pageToken).toBe('start-token-100');
      expect(savedState.appliedFileIds).toContain('uploaded-journal-id-1');
      expect(savedState.appliedFileIds).toContain('remote-journal-persist');
      expect(savedState.peerWatermarks?.['peer-persist']).toBe(
        '2026-10-15T12:00:00.000Z_0000_peer-persist'
      );

      // Invariant: localStorage must NOT be touched
      expect(localStorageSetSpy).not.toHaveBeenCalled();
      expect(localStorageGetSpy).not.toHaveBeenCalled();

      // 3. Create fresh transport2 with the same stateRepo (simulating tab reload / independent transport)
      const transport2 = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
        stateRepo: mockStateRepo,
      });

      // Subsequent pull on transport2 should restore state and call listChanges directly with restored token
      vi.mocked(mockDriveClient.listFiles).mockClear();
      vi.mocked(mockDriveClient.getStartPageToken).mockClear();
      vi.mocked(mockDriveClient.listChanges).mockResolvedValueOnce({
        changes: [],
        newStartPageToken: 'token-after-reload-pull',
      });

      const pull2 = await transport2.pull(credentials, 1);

      expect(mockDriveClient.listFiles).not.toHaveBeenCalled();
      expect(mockDriveClient.getStartPageToken).not.toHaveBeenCalled();
      expect(mockDriveClient.listChanges).toHaveBeenCalledWith(
        'start-token-100',
        'valid-access-token-999'
      );
      expect(pull2.changes).toHaveLength(0);
      expect(transport2.getPageToken(credentials.userId, credentials.deviceId)).toBe(
        'token-after-reload-pull'
      );
      expect(transport2.getAppliedFileIds().has('uploaded-journal-id-1')).toBe(true);
      expect(transport2.getAppliedFileIds().has('remote-journal-persist')).toBe(true);
      expect(transport2.getPeerWatermarks()['peer-persist']).toBe(
        '2026-10-15T12:00:00.000Z_0000_peer-persist'
      );
    });

    it('caps persisted appliedFileIds to MAX_PERSISTED_APPLIED_FILES using LRU ordering', async () => {
      const inMemorySyncStore = new Map<string, SyncState>();
      const stateKey = `${credentials.userId}:${credentials.deviceId}`;

      // Seed 1,050 file IDs into syncState
      const initialIds: string[] = [];
      for (let i = 0; i < 1050; i++) {
        initialIds.push(`file-seed-${i}`);
      }
      inMemorySyncStore.set(stateKey, {
        key: stateKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 0,
        pageToken: 'token-seeded',
        appliedFileIds: initialIds,
      });

      const mockStateRepo: SyncStateRepository = {
        getSyncState: vi.fn(async (key: string) => inMemorySyncStore.get(key) ?? null),
        saveSyncState: vi.fn(async (state: SyncState) => {
          inMemorySyncStore.set(state.key, { ...state });
        }),
      };

      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
        stateRepo: mockStateRepo,
      });

      vi.mocked(mockDriveClient.listChanges).mockResolvedValueOnce({
        changes: [],
        newStartPageToken: 'token-after-changes',
      });

      // Pull loads state and enforces MAX_PERSISTED_APPLIED_FILES (1,000)
      await transport.pull(credentials, 0);

      expect(transport.getAppliedFileIds().size).toBe(MAX_PERSISTED_APPLIED_FILES);
      expect(transport.getAppliedFileIds().has('file-seed-0')).toBe(false);
      expect(transport.getAppliedFileIds().has('file-seed-49')).toBe(false);
      expect(transport.getAppliedFileIds().has('file-seed-50')).toBe(true);
      expect(transport.getAppliedFileIds().has('file-seed-1049')).toBe(true);

      const savedState = inMemorySyncStore.get(stateKey)!;
      expect(savedState.appliedFileIds).toHaveLength(MAX_PERSISTED_APPLIED_FILES);
      expect(savedState.appliedFileIds![0]).toBe('file-seed-50');
      expect(savedState.appliedFileIds![savedState.appliedFileIds!.length - 1]).toBe(
        'file-seed-1049'
      );
    });

    it('handles repository errors gracefully without crashing push or pull', async () => {
      const throwingRepo: SyncStateRepository = {
        getSyncState: vi.fn().mockRejectedValue(new Error('IndexedDB transaction failed')),
        saveSyncState: vi.fn().mockRejectedValue(new Error('QuotaExceededError: disk full')),
      };

      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
        stateRepo: throwingRepo,
      });

      expect(transport.getAppliedFileIds().size).toBe(0);

      // Push does not crash when saveSyncState throws
      await expect(
        transport.push(credentials, {
          deviceId: credentials.deviceId,
          mutations: [
            {
              clientMutationId: 'm-err-1',
              entityType: 'document',
              entityId: 'doc-err',
              operation: 'UPSERT',
              clientTimestamp: '2026-10-15T12:00:00.000Z',
              payload: {},
            },
          ],
        })
      ).resolves.toBeDefined();

      // clearState clears in-memory structures safely
      transport.setPageToken(credentials.userId, credentials.deviceId, 'some-token');
      transport.clearState(credentials);
      expect(transport.getPageToken(credentials.userId, credentials.deviceId)).toBeUndefined();
    });
  });

  describe('Vault Baseline Seeding & driveSeeded barrier', () => {
    it('seeds cold remote with baseline snapshot and commits driveSeeded: true to syncState', async () => {
      const db = getActiveVaultDatabase();
      await db.documentContents.put({
        documentId: 'doc-initial-1',
        title: 'Initial Note',
        content: '# Offline note created before connecting Drive',
        updatedAt: '2026-10-12T10:00:00.000Z',
        version: 1,
      });

      // Cold remote: 0 remote snapshots and 0 remote journals
      vi.mocked(mockDriveClient.listFiles).mockResolvedValueOnce([]);

      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
        db,
      });

      expect(transport.isDriveSeeded()).toBe(false);

      const pullResponse = await transport.pull(credentials, 0);

      // Uploads synthesized baseline as snapshot_${hlc}_${deviceId}.json.gz
      expect(mockDriveClient.uploadCompressedJson).toHaveBeenCalledTimes(1);
      const [fileName, payload, appProps, token, parents] = vi.mocked(
        mockDriveClient.uploadCompressedJson!
      ).mock.calls[0]!;

      expect(fileName).toMatch(/^snapshot_.+_dev-client-1\.json\.gz$/);
      expect(appProps).toEqual({
        type: 'snapshot',
        deviceId: 'dev-client-1',
        hlc: expect.any(String),
        count: '1',
      });
      expect(token).toBe('valid-access-token-999');
      expect(parents).toEqual(['appDataFolder']);

      const snapshotPayload = payload as { version: number; mutations: SyncPushRequest['mutations'] };
      expect(snapshotPayload.version).toBe(1);
      expect(snapshotPayload.mutations).toHaveLength(1);
      expect(snapshotPayload.mutations[0]!.entityId).toBe('doc-initial-1');
      expect(snapshotPayload.mutations[0]!.clientTimestamp).toBe(
        '2026-10-12T10:00:00.000Z_0000_dev-client-1'
      );

      // driveSeeded is committed to syncState and marked on transport
      expect(transport.isDriveSeeded()).toBe(true);
      const stateKey = `${credentials.userId}:${credentials.deviceId}`;
      const persistedState = await db.syncState.get(stateKey);
      expect(persistedState?.driveSeeded).toBe(true);
      expect(transport.getAppliedFileIds().has('uploaded-journal-id-1')).toBe(true);

      // Clean cold return
      expect(pullResponse.changes).toHaveLength(0);
      expect(pullResponse.newCursor).toBe(0);
    });

    it('seeds warm remote with local delta journal when local has newer record', async () => {
      const db = getActiveVaultDatabase();
      // Local document updated on 2026-10-15 (newer than remote 2026-10-10)
      await db.documentContents.put({
        documentId: 'doc-shared-1',
        title: 'Local Revision',
        content: '# Revised locally while offline',
        updatedAt: '2026-10-15T12:00:00.000Z',
        version: 2,
      });

      const remoteFile: DriveFileMetadata = {
        id: 'remote-file-journal-1',
        name: 'journal_2026-10-10T10:00:00.000Z_0000_peer-dev.json.gz',
        appProperties: {
          type: 'journal',
          deviceId: 'peer-dev',
          hlc: '2026-10-10T10:00:00.000Z_0000_peer-dev',
          count: '1',
        },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValueOnce([remoteFile]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValueOnce({
        hlc: '2026-10-10T10:00:00.000Z_0000_peer-dev',
        deviceId: 'peer-dev',
        createdAt: '2026-10-10T10:00:00.000Z',
        mutations: [
          {
            clientMutationId: 'remote-mut-1',
            entityType: 'document',
            entityId: 'doc-shared-1',
            operation: 'UPSERT',
            baseVersion: 1,
            clientTimestamp: '2026-10-10T10:00:00.000Z',
            payload: {
              documentId: 'doc-shared-1',
              title: 'Remote Peer Document',
              content: '# Remote content from earlier',
              updatedAt: '2026-10-10T10:00:00.000Z',
              version: 1,
            },
          },
        ],
      });

      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
        db,
      });

      const pullResponse = await transport.pull(credentials, 0);

      // Remote file was downloaded
      expect(mockDriveClient.downloadCompressedJson).toHaveBeenCalledWith(
        'remote-file-journal-1',
        'valid-access-token-999'
      );

      // Local delta is newer, so emitted as journal_${hlc}_${deviceId}.json.gz
      expect(mockDriveClient.uploadCompressedJson).toHaveBeenCalledTimes(1);
      const [fileName, payload, appProps] = vi.mocked(
        mockDriveClient.uploadCompressedJson!
      ).mock.calls[0]!;

      expect(fileName).toMatch(/^journal_.+\.json\.gz$/);
      expect(appProps?.type).toBe('journal');
      const journalPayload = payload as { mutations: SyncPushRequest['mutations'] };
      expect(journalPayload.mutations).toHaveLength(1);
      expect(journalPayload.mutations[0]!.entityId).toBe('doc-shared-1');
      expect(journalPayload.mutations[0]!.clientTimestamp).toBe(
        '2026-10-15T12:00:00.000Z_0000_dev-client-1'
      );

      // Marked seeded and committed
      expect(transport.isDriveSeeded()).toBe(true);
      const stateKey = `${credentials.userId}:${credentials.deviceId}`;
      const state = await db.syncState.get(stateKey);
      expect(state?.driveSeeded).toBe(true);

      // Returns remote changes in pull response
      expect(pullResponse.changes).toHaveLength(1);
      expect(pullResponse.changes[0]!.entityId).toBe('doc-shared-1');
    });

    it('skips uploading deltas on warm remote when local is clean', async () => {
      const db = getActiveVaultDatabase();
      // Vault is clean / empty

      const remoteFile: DriveFileMetadata = {
        id: 'remote-clean-journal-1',
        name: 'journal_2026-10-10T10:00:00.000Z_0000_peer-dev.json.gz',
        appProperties: {
          type: 'journal',
          deviceId: 'peer-dev',
          hlc: '2026-10-10T10:00:00.000Z_0000_peer-dev',
          count: '1',
        },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValueOnce([remoteFile]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValueOnce({
        hlc: '2026-10-10T10:00:00.000Z_0000_peer-dev',
        deviceId: 'peer-dev',
        createdAt: '2026-10-10T10:00:00.000Z',
        mutations: [
          {
            clientMutationId: 'clean-remote-mut',
            entityType: 'document',
            entityId: 'doc-remote-only',
            operation: 'UPSERT',
            baseVersion: 1,
            clientTimestamp: '2026-10-10T10:00:00.000Z',
            payload: {
              documentId: 'doc-remote-only',
              title: 'Remote Note',
              content: '# Content',
              updatedAt: '2026-10-10T10:00:00.000Z',
              version: 1,
            },
          },
        ],
      });

      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
        db,
      });

      const pullResponse = await transport.pull(credentials, 0);

      // Remote file was downloaded
      expect(mockDriveClient.downloadCompressedJson).toHaveBeenCalledTimes(1);

      // 0 uploads on clean warm remote
      expect(mockDriveClient.uploadCompressedJson).not.toHaveBeenCalled();
      expect(mockDriveClient.uploadFile).not.toHaveBeenCalled();

      // Marked seeded and committed
      expect(transport.isDriveSeeded()).toBe(true);
      const stateKey = `${credentials.userId}:${credentials.deviceId}`;
      const state = await db.syncState.get(stateKey);
      expect(state?.driveSeeded).toBe(true);

      expect(pullResponse.changes).toHaveLength(1);
    });

    it('does not commit driveSeeded: true if upload fails during cold seeding', async () => {
      const db = getActiveVaultDatabase();
      await db.documentContents.put({
        documentId: 'doc-crash-1',
        title: 'Crash test note',
        content: '# Content',
        updatedAt: '2026-10-10T10:00:00.000Z',
        version: 1,
      });

      // Cold remote
      vi.mocked(mockDriveClient.listFiles).mockResolvedValueOnce([]);
      // Upload fails
      vi.mocked(mockDriveClient.uploadCompressedJson!).mockRejectedValueOnce(
        new Error('Network error during snapshot upload')
      );

      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
        db,
      });

      await expect(transport.pull(credentials, 0)).rejects.toThrow(
        'Network error during snapshot upload'
      );

      // driveSeeded is NOT true
      expect(transport.isDriveSeeded()).toBe(false);
      const stateKey = `${credentials.userId}:${credentials.deviceId}`;
      const state = await db.syncState.get(stateKey);
      expect(state?.driveSeeded).toBeFalsy();
    });

    it('restores driveSeeded flag from syncState across transport instances', async () => {
      const db = getActiveVaultDatabase();
      const stateKey = `${credentials.userId}:${credentials.deviceId}`;
      await db.syncState.put({
        key: stateKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 5,
        pageToken: 'token-active-1',
        driveSeeded: true,
      });

      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
        db,
      });

      expect(transport.isDriveSeeded()).toBe(false);

      vi.mocked(mockDriveClient.listChanges).mockResolvedValueOnce({
        changes: [],
        newStartPageToken: 'token-active-2',
      });

      await transport.pull(credentials, 5);

      expect(transport.isDriveSeeded()).toBe(true);
      // Cold/warm seeding was not triggered
      expect(mockDriveClient.uploadCompressedJson).not.toHaveBeenCalled();
    });

    it('wires onTokenExpired callback to driveClient and refreshes token via authService', async () => {
      let registeredCallback: (() => Promise<string>) | undefined;
      const customDriveClient: GoogleDrivePort = {
        ...mockDriveClient,
        setOnTokenExpired: vi.fn((cb?: () => Promise<string>) => {
          registeredCallback = cb;
        }),
      };

      new GoogleDriveSyncTransport({
        driveClient: customDriveClient,
        authService: mockAuthService,
      });

      expect(customDriveClient.setOnTokenExpired).toHaveBeenCalledTimes(1);
      expect(registeredCallback).toBeDefined();

      const refreshed = await registeredCallback!();
      expect(refreshed).toBe('valid-access-token-999');
      expect(mockAuthService.getValidAccessToken).toHaveBeenCalledWith(true);
    });

    it('resumes interrupted cold seed in warm mode by uploading only entities not yet present remotely', async () => {
      const db = getActiveVaultDatabase();
      // Vault has 2 documents and 1 highlight:
      // doc-1 was uploaded before crash in chunk 1 (2026-10-10)
      await db.documentContents.put({
        documentId: 'doc-1',
        title: 'Already Uploaded Document',
        content: '# Content 1',
        updatedAt: '2026-10-10T10:00:00.000Z',
        version: 1,
      });

      // doc-2 was NOT uploaded (2026-10-10)
      await db.documentContents.put({
        documentId: 'doc-2',
        title: 'Pending Document',
        content: '# Content 2',
        updatedAt: '2026-10-10T10:00:00.000Z',
        version: 1,
      });

      // hl-1 was NOT uploaded (2026-10-10)
      await db.highlights.put({
        id: 'hl-1',
        documentId: 'doc-1',
        start: 0,
        end: 10,
        color: 'yellow',
        text: 'Sample',
        createdAt: '2026-10-10T10:00:00.000Z',
      });

      // Remote has chunk 1 from earlier interrupted seed containing doc-1
      const chunk1File: DriveFileMetadata = {
        id: 'remote-seed-chunk-1',
        name: 'snapshot_2026-10-10T10:00:00.000Z_0000_dev-client-1_part1.json.gz',
        appProperties: {
          type: 'snapshot',
          deviceId: 'dev-client-1',
          hlc: '2026-10-10T10:00:00.000Z_0000_dev-client-1',
          isSeedPart: 'true',
          partIndex: '0',
          totalParts: '2',
        },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValueOnce([chunk1File]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValueOnce({
        version: 1,
        hlc: '2026-10-10T10:00:00.000Z_0000_dev-client-1',
        deviceId: 'dev-client-1',
        watermarks: { 'dev-client-1': '2026-10-10T10:00:00.000Z_0000_dev-client-1' },
        mutations: [
          {
            clientMutationId: 'baseline-doc-doc-1',
            entityType: 'document',
            entityId: 'doc-1',
            operation: 'UPSERT',
            baseVersion: 1,
            clientTimestamp: '2026-10-10T10:00:00.000Z_0000_dev-client-1',
            payload: {
              documentId: 'doc-1',
              title: 'Already Uploaded Document',
              content: '# Content 1',
              updatedAt: '2026-10-10T10:00:00.000Z',
              version: 1,
            },
          },
        ],
      });

      const transport = new GoogleDriveSyncTransport({
        driveClient: mockDriveClient,
        authService: mockAuthService,
        db,
      });

      expect(transport.isDriveSeeded()).toBe(false);

      await transport.pull(credentials, 0);

      // Verify that delta upload was called with ONLY doc-2 and hl-1 (doc-1 omitted)
      expect(mockDriveClient.uploadCompressedJson).toHaveBeenCalledTimes(1);
      const [fileName, payload, appProps] = vi.mocked(
        mockDriveClient.uploadCompressedJson!
      ).mock.calls[0]!;

      expect(fileName).toMatch(/^journal_.+\.json\.gz$/);
      expect(appProps?.type).toBe('journal');
      const journalPayload = payload as { mutations: SyncPushRequest['mutations'] };
      const uploadedEntityIds = journalPayload.mutations.map((m) => m.entityId);

      // doc-1 was already remote with identical HLC -> skipped
      expect(uploadedEntityIds).not.toContain('doc-1');
      // doc-2 and hl-1 were not remote -> uploaded
      expect(uploadedEntityIds).toContain('doc-2');
      expect(uploadedEntityIds).toContain('hl-1');
      expect(uploadedEntityIds).toHaveLength(2);

      // Now driveSeeded is true
      expect(transport.isDriveSeeded()).toBe(true);
      const stateKey = `${credentials.userId}:${credentials.deviceId}`;
      const state = await db.syncState.get(stateKey);
      expect(state?.driveSeeded).toBe(true);
    });
  });
});
