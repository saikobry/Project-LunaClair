import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../../database/schema/LunaClairDatabase';
import { GoogleDriveSyncTransport } from '../GoogleDriveSyncTransport';
import { DexieSyncStateRepository } from '../../../database/repositories/DexieSyncStateRepository';
import { DexieSyncReconciler } from '../../../database/sync/DexieSyncReconciler';
import { GoogleDriveClient } from '../../google/GoogleDriveClient';
import type {
  GoogleDrivePort,
  DriveFileMetadata,
} from '../../../../domain/drive/models/drive.types';
import { DriveHttpError } from '../../../../domain/drive/models/drive.types';
import type { GoogleAuthPort } from '../../../../domain/auth/models/auth.types';
import type {
  SessionCredentials,
  SyncMutation,
  PullReceipt,
} from '../../../../domain/sync/models/sync.types';

describe('GoogleDriveSyncTransport Pull Durability & Bounded Checkpoints (R5/R6)', () => {
  const credentials: SessionCredentials = {
    userId: 'user-durability-test',
    deviceId: 'device-durability-test',
    token: 'mock-token',
  };

  const isoTime = '2026-10-25T10:00:00.000Z';
  const hlcTime = `${isoTime}_0000_peer-1`;

  let testDb: LunaClairDatabase;
  let stateRepo: DexieSyncStateRepository;
  let reconciler: DexieSyncReconciler;
  let mockDriveClient: GoogleDrivePort;
  let mockAuthService: GoogleAuthPort;

  const createDrawingMutation = (index: number): SyncMutation => ({
    clientMutationId: `mut-draw-${index}`,
    entityType: 'drawing',
    entityId: `draw-id-${index}`,
    operation: 'UPSERT',
    clientTimestamp: isoTime,
    payload: {
      id: `draw-id-${index}`,
      documentId: 'doc-sync-1',
      color: '#00ff00',
      thickness: 2,
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.8, y: 0.9 },
      ],
      createdAt: isoTime,
    },
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    testDb = new LunaClairDatabase(`test-pull-durability-${crypto.randomUUID()}`);
    await testDb.open();
    stateRepo = new DexieSyncStateRepository(testDb);
    reconciler = new DexieSyncReconciler(testDb, () => true);

    // Initial state: seeded
    await stateRepo.saveSyncState({
      key: `${credentials.userId}:${credentials.deviceId}`,
      userId: credentials.userId,
      deviceId: credentials.deviceId,
      lastServerCursor: 0,
      driveSeeded: true,
      appliedFileIds: [],
    });

    mockAuthService = {
      login: vi.fn(),
      logout: vi.fn(),
      getValidAccessToken: vi.fn(async () => 'valid-access-token-123'),
      getSession: vi.fn(() => null),
      getStatus: vi.fn(() => 'authenticated' as const),
      subscribe: vi.fn(() => () => {}),
    };

    mockDriveClient = {
      generateFileId: vi.fn(async () => 'mock-gen-id'),
      uploadFile: vi.fn(),
      downloadFile: vi.fn(),
      downloadBinary: vi.fn(),
      deleteFile: vi.fn(),
      listFiles: vi.fn(async () => []),
      getStartPageToken: vi.fn(async () => 'TOKEN_START'),
      listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'TOKEN_WARM_1' })),
      recover410Cursor: vi.fn(async () => ({ newPageToken: 'TOKEN_RECOVERED', missingFiles: [] })),
      uploadCompressedJson: vi.fn(async () => ({ id: 'mock-id', name: 'mock-name' }) as any),
      downloadCompressedJson: vi.fn(async () => ({
        hlc: hlcTime,
        deviceId: 'peer-1',
        createdAt: isoTime,
        mutations: [],
      }) as any),
      recoverFromInvalidPageToken: vi.fn(async () => ({ newPageToken: 'TOKEN_RECOVERED', missingFiles: [] })),
    };
  });

  afterEach(async () => {
    try {
      testDb.close();
      await testDb.delete();
    } catch {
      // ignore
    }
    vi.restoreAllMocks();
  });

  describe('Scenario 1: >100 operations in one journal (160 and 194 mutations)', () => {
    it('pulls 160 mutations across two bounded batches without loss and with durable receipt progress', async () => {
      const totalMutations = 160;
      const fileId = 'journal-160-ops';
      const mutations = Array.from({ length: totalMutations }, (_, i) => createDrawingMutation(i));

      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: {
          type: 'journal',
          hlc: hlcTime,
          deviceId: 'peer-1',
        },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([fileMeta]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-1',
        createdAt: isoTime,
        mutations,
      });

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      // Pull 1: cursor = 0, limit = 100
      const pull1 = await transport.pull(credentials, 0, 100);

      expect(pull1.changes).toHaveLength(100);
      expect(pull1.newCursor).toBe(100);
      expect(pull1.hasMore).toBe(true);

      // Verify file is NOT marked applied yet in memory or in DB
      expect(transport.getAppliedFileIds().has(fileId)).toBe(false);
      const stateAfterPull1 = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(stateAfterPull1?.appliedFileIds ?? []).not.toContain(fileId);

      // Verify receipt conveys pending partial progress
      expect(pull1.receipt).toBeDefined();
      expect(pull1.receipt?.appliedFileIds).not.toContain(fileId);
      expect(pull1.receipt?.pendingFileProgress).toEqual({
        fileId,
        offset: 100,
        totalMutations: 160,
      });

      // Verify returned changes are first 100 mutations (0..99)
      expect(pull1.changes[0].entityId).toBe('draw-id-0');
      expect(pull1.changes[99].entityId).toBe('draw-id-99');

      // Engine reconciles and acknowledges pull 1
      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, pull1);
      if (typeof transport.acknowledgePull === 'function') {
        await transport.acknowledgePull(credentials, pull1.receipt!);
      }

      // Pull 2: cursor = 100, limit = 100
      const pull2 = await transport.pull(credentials, 100, 100);

      expect(pull2.changes).toHaveLength(60);
      expect(pull2.newCursor).toBe(160);
      expect(pull2.hasMore).toBe(false);

      // Verify returned changes are tail 60 mutations (100..159)
      expect(pull2.changes[0].entityId).toBe('draw-id-100');
      expect(pull2.changes[59].entityId).toBe('draw-id-159');

      // Verify receipt indicates completion
      expect(pull2.receipt).toBeDefined();
      expect(pull2.receipt?.appliedFileIds).toContain(fileId);
      expect(pull2.receipt?.pendingFileProgress).toBeUndefined();

      // Engine reconciles and acknowledges pull 2
      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 100, pull2);
      if (typeof transport.acknowledgePull === 'function') {
        await transport.acknowledgePull(credentials, pull2.receipt!);
      }

      // Now transport memory records file as applied
      expect(transport.getAppliedFileIds().has(fileId)).toBe(true);

      // Total received: 160 distinct operations, completely lossless
      const allReceivedIds = [...pull1.changes, ...pull2.changes].map((c) => c.entityId);
      expect(allReceivedIds).toHaveLength(160);
      expect(new Set(allReceivedIds).size).toBe(160);
    });

    it('correctly handles 194 mutations across 100 and 94 mutation slices', async () => {
      const totalMutations = 194;
      const fileId = 'journal-194-ops';
      const mutations = Array.from({ length: totalMutations }, (_, i) => createDrawingMutation(i));

      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-1' },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([fileMeta]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-1',
        createdAt: isoTime,
        mutations,
      });

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      // Batch 1 (limit 100)
      const pull1 = await transport.pull(credentials, 0, 100);
      expect(pull1.changes).toHaveLength(100);
      expect(pull1.hasMore).toBe(true);
      expect(pull1.receipt?.pendingFileProgress).toEqual({
        fileId,
        offset: 100,
        totalMutations: 194,
      });

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, pull1);
      if (typeof transport.acknowledgePull === 'function') {
        await transport.acknowledgePull(credentials, pull1.receipt!);
      }

      // Batch 2 (limit 100)
      const pull2 = await transport.pull(credentials, 100, 100);
      expect(pull2.changes).toHaveLength(94);
      expect(pull2.hasMore).toBe(false);
      expect(pull2.receipt?.appliedFileIds).toContain(fileId);
      expect(pull2.receipt?.pendingFileProgress).toBeUndefined();

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 100, pull2);
      if (typeof transport.acknowledgePull === 'function') {
        await transport.acknowledgePull(credentials, pull2.receipt!);
      }

      expect(transport.getAppliedFileIds().has(fileId)).toBe(true);
    });
  });

  describe('Scenario 2: Multiple journals aggregating >100 mutations (40 + 50 + 30)', () => {
    it('slices across multiple journal files and partial file boundary cleanly', async () => {
      const j1Mutations = Array.from({ length: 40 }, (_, i) => createDrawingMutation(i));
      const j2Mutations = Array.from({ length: 50 }, (_, i) => createDrawingMutation(40 + i));
      const j3Mutations = Array.from({ length: 30 }, (_, i) => createDrawingMutation(90 + i));

      const files: DriveFileMetadata[] = [
        { id: 'journal-1', name: 'journal_1.json.gz', appProperties: { type: 'journal', hlc: hlcTime } },
        { id: 'journal-2', name: 'journal_2.json.gz', appProperties: { type: 'journal', hlc: hlcTime } },
        { id: 'journal-3', name: 'journal_3.json.gz', appProperties: { type: 'journal', hlc: hlcTime } },
      ];

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue(files);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockImplementation(async (fileId) => {
        if (fileId === 'journal-1') return { hlc: hlcTime, deviceId: 'peer-1', createdAt: isoTime, mutations: j1Mutations };
        if (fileId === 'journal-2') return { hlc: hlcTime, deviceId: 'peer-1', createdAt: isoTime, mutations: j2Mutations };
        if (fileId === 'journal-3') return { hlc: hlcTime, deviceId: 'peer-1', createdAt: isoTime, mutations: j3Mutations };
        throw new Error(`Unexpected fileId ${fileId}`);
      });

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      // Pull 1: limit 100
      // Expected: 40 from J1 + 50 from J2 + 10 from J3 = 100 mutations
      const pull1 = await transport.pull(credentials, 0, 100);
      expect(pull1.changes).toHaveLength(100);
      expect(pull1.hasMore).toBe(true);

      // J1 and J2 are fully consumed; J3 is partial
      expect(pull1.receipt?.appliedFileIds).toEqual(expect.arrayContaining(['journal-1', 'journal-2']));
      expect(pull1.receipt?.appliedFileIds).not.toContain('journal-3');
      expect(pull1.receipt?.pendingFileProgress).toEqual({
        fileId: 'journal-3',
        offset: 10,
        totalMutations: 30,
      });

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, pull1);
      if (typeof transport.acknowledgePull === 'function') {
        await transport.acknowledgePull(credentials, pull1.receipt!);
      }

      // Pull 2: limit 100
      // Expected: remaining 20 mutations from J3
      const pull2 = await transport.pull(credentials, 100, 100);
      expect(pull2.changes).toHaveLength(20);
      expect(pull2.hasMore).toBe(false);

      expect(pull2.receipt?.appliedFileIds).toContain('journal-3');
      expect(pull2.receipt?.pendingFileProgress).toBeUndefined();

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 100, pull2);
      if (typeof transport.acknowledgePull === 'function') {
        await transport.acknowledgePull(credentials, pull2.receipt!);
      }

      expect(transport.getAppliedFileIds().has('journal-1')).toBe(true);
      expect(transport.getAppliedFileIds().has('journal-2')).toBe(true);
      expect(transport.getAppliedFileIds().has('journal-3')).toBe(true);
    });
  });

  describe('Scenario 3: Interruption / Crash Before Reconcile (R6 regression)', () => {
    it('does not advance Dexie syncState or mark file applied if interrupted before reconcile', async () => {
      const fileId = 'journal-crash-before-reconcile';
      const mutations = [createDrawingMutation(1), createDrawingMutation(2), createDrawingMutation(3)];

      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-1' },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([fileMeta]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-1',
        createdAt: isoTime,
        mutations,
      });

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      // Transport pulls changes
      const pullResult = await transport.pull(credentials, 0, 100);
      expect(pullResult.changes).toHaveLength(3);

      // SIMULATE CRASH:
      // No reconcile runs, no acknowledgePull called.
      // Critical check: Dexie syncState must NOT contain fileId in appliedFileIds!
      const persistedState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(persistedState?.appliedFileIds ?? []).not.toContain(fileId);

      // Transport restarts in a new session
      const restartedTransport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      // Restarted transport pulls: the file is NOT skipped because it was never committed as applied!
      const resumedPull = await restartedTransport.pull(credentials, 0, 100);
      expect(resumedPull.changes).toHaveLength(3);
      expect(resumedPull.changes.map((c) => c.entityId)).toEqual(['draw-id-1', 'draw-id-2', 'draw-id-3']);
    });
  });

  describe('Scenario 4: Partial File Resumption After Crash', () => {
    it('resumes from pendingFileProgress offset in Dexie after process restart', async () => {
      const fileId = 'journal-restart-resumption';
      const totalMutations = 160;
      const mutations = Array.from({ length: totalMutations }, (_, i) => createDrawingMutation(i));

      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-1' },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([fileMeta]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-1',
        createdAt: isoTime,
        mutations,
      });

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      // Pull 1: returns first 100
      const pull1 = await transport.pull(credentials, 0, 100);
      expect(pull1.changes).toHaveLength(100);

      // Reconciler persists batch 1 and writes pendingFileProgress to syncState
      await stateRepo.saveSyncState({
        key: `${credentials.userId}:${credentials.deviceId}`,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 100,
        driveSeeded: true,
        appliedFileIds: [],
        pendingFileProgress: {
          fileId,
          offset: 100,
          totalMutations: 160,
        },
      });

      // SIMULATE CRASH & RESTART
      const restartedTransport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      // Next pull with restarted transport: resumes at offset 100
      const pull2 = await restartedTransport.pull(credentials, 100, 100);
      expect(pull2.changes).toHaveLength(60);
      expect(pull2.changes[0].entityId).toBe('draw-id-100');
      expect(pull2.changes[59].entityId).toBe('draw-id-159');
      expect(pull2.hasMore).toBe(false);
      expect(pull2.receipt?.appliedFileIds).toContain(fileId);
      expect(pull2.receipt?.pendingFileProgress).toBeUndefined();
    });
  });

  describe('Scenario 5: Multi-page Warm Changes & Token Anchoring', () => {
    it('does not advance pageToken until all candidate files from the page are completed', async () => {
      // Warm sync: pageToken already exists in syncState
      await stateRepo.saveSyncState({
        key: `${credentials.userId}:${credentials.deviceId}`,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 0,
        driveSeeded: true,
        pageToken: 'TOKEN_PAGE_1',
        appliedFileIds: [],
      });

      const f1Mutations = Array.from({ length: 70 }, (_, i) => createDrawingMutation(i));
      const f2Mutations = Array.from({ length: 70 }, (_, i) => createDrawingMutation(70 + i));

      // listChanges returns page 1 with nextPageToken and 2 files
      vi.mocked(mockDriveClient.listChanges).mockResolvedValue({
        changes: [
          { fileId: 'file-page-1', file: { id: 'file-page-1', name: 'f1.json.gz', appProperties: { type: 'journal' } } },
          { fileId: 'file-page-2', file: { id: 'file-page-2', name: 'f2.json.gz', appProperties: { type: 'journal' } } },
        ],
        nextPageToken: 'TOKEN_PAGE_2',
      });

      vi.mocked(mockDriveClient.downloadCompressedJson!).mockImplementation(async (fileId) => {
        if (fileId === 'file-page-1') return { hlc: hlcTime, deviceId: 'peer-1', createdAt: isoTime, mutations: f1Mutations };
        if (fileId === 'file-page-2') return { hlc: hlcTime, deviceId: 'peer-1', createdAt: isoTime, mutations: f2Mutations };
        throw new Error(`Unexpected ${fileId}`);
      });

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      // Pull 1: 70 from file-page-1 + 30 from file-page-2 = 100
      const pull1 = await transport.pull(credentials, 0, 100);
      expect(pull1.changes).toHaveLength(100);
      expect(pull1.hasMore).toBe(true);

      // Invariant: pageToken must NOT advance to TOKEN_PAGE_2 because file-page-2 is incomplete!
      expect(pull1.receipt?.pageToken).not.toBe('TOKEN_PAGE_2');

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, pull1);
      if (typeof transport.acknowledgePull === 'function') {
        await transport.acknowledgePull(credentials, pull1.receipt!);
      }

      // Pull 2: remaining 40 from file-page-2
      const pull2 = await transport.pull(credentials, 100, 100);
      expect(pull2.changes).toHaveLength(40);
      expect(pull2.hasMore).toBe(true);

      // Now all files from page 1 completed; pageToken advances
      expect(pull2.receipt?.pageToken).toBe('TOKEN_PAGE_2');

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 100, pull2);
      if (typeof transport.acknowledgePull === 'function') {
        await transport.acknowledgePull(credentials, pull2.receipt!);
      }
    });

    it('recovers from 410 Gone without dropping unapplied files', async () => {
      await stateRepo.saveSyncState({
        key: `${credentials.userId}:${credentials.deviceId}`,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 0,
        driveSeeded: true,
        pageToken: 'TOKEN_EXPIRED',
        appliedFileIds: [],
      });

      const mutations = [createDrawingMutation(1), createDrawingMutation(2)];
      const missingFile: DriveFileMetadata = {
        id: 'file-410-recovered',
        name: 'recovered.json.gz',
        appProperties: { type: 'journal' },
      };

      vi.mocked(mockDriveClient.listChanges).mockRejectedValueOnce(
        new DriveHttpError('Page token expired', 410, 'Gone')
      );

      vi.mocked(mockDriveClient.recoverFromInvalidPageToken!).mockResolvedValue({
        newPageToken: 'TOKEN_FRESH_START',
        missingFiles: [missingFile],
      });

      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-1',
        createdAt: isoTime,
        mutations,
      });

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      const pull = await transport.pull(credentials, 0, 100);
      expect(pull.changes).toHaveLength(2);
      expect(pull.changes[0].entityId).toBe('draw-id-1');
      expect(pull.changes[1].entityId).toBe('draw-id-2');
    });
  });

  describe('Scenario 6: Account switch and Disposal fence', () => {
    it('rejects acknowledgePull if transport is disposed', async () => {
      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      transport.dispose();

      const receipt: PullReceipt = {
        receiptId: 'receipt-1',
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        appliedFileIds: ['file-1'],
      };

      if (typeof transport.acknowledgePull === 'function') {
        await expect(transport.acknowledgePull(credentials, receipt)).rejects.toThrow(
          /disposed|aborted/i
        );
      }
    });

    it('rejects or ignores receipt from a different user account', async () => {
      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: mockDriveClient,
        authService: mockAuthService,
        expectedSub: credentials.userId,
      });

      const foreignCredentials: SessionCredentials = {
        userId: 'user-intruder',
        deviceId: 'device-intruder',
      };

      const foreignReceipt: PullReceipt = {
        receiptId: 'receipt-foreign',
        userId: 'user-intruder',
        deviceId: 'device-intruder',
        appliedFileIds: ['file-foreign'],
      };

      if (typeof transport.acknowledgePull === 'function') {
        await expect(
          transport.acknowledgePull(foreignCredentials, foreignReceipt)
        ).rejects.toThrow();
      }
    });
  });

  describe('Scenario 7 (Probe 1): Partial-journal 410 recovery with real GoogleDriveClient.recover410Cursor', () => {
    it('survives 410 cursor expiration without dropping unconsumed partial journal tail mutations', async () => {
      const totalMutations = 160;
      const fileId = 'partial-journal-410';
      const fileHlc = `${isoTime}_0000_peer-410`;
      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${fileHlc}.json.gz`,
        appProperties: {
          type: 'journal',
          hlc: fileHlc,
          deviceId: 'peer-410',
        },
      };

      const realClient = new GoogleDriveClient({
        fetch: async () => {
          throw new Error('Network forbidden');
        },
      });
      realClient.getStartPageToken = vi.fn(async () => 'TOKEN_RECOVERED_START');
      realClient.listFiles = vi.fn(async () => [fileMeta]);

      let expired = false;
      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'TOKEN_START'),
        listFiles: vi.fn(async () => [fileMeta]),
        listChanges: vi.fn(async () => {
          if (expired) {
            throw new DriveHttpError('Page token expired', 410, 'Gone');
          }
          return {
            changes: [{ fileId, file: fileMeta }],
            newStartPageToken: 'TOKEN_WARM_HEAD',
          };
        }),
        downloadCompressedJson: vi.fn(async () => ({
          hlc: fileHlc,
          deviceId: 'peer-410',
          createdAt: isoTime,
          mutations: Array.from({ length: totalMutations }, (_, i) => createDrawingMutation(i)),
        })) as any,
        recoverFromInvalidPageToken: (params) => realClient.recover410Cursor(params),
        recover410Cursor: (params) => realClient.recover410Cursor(params),
      };

      const reconciler = new DexieSyncReconciler(testDb, () => true);

      // Warm sync initial state
      await stateRepo.saveSyncState({
        key: `${credentials.userId}:${credentials.deviceId}`,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 0,
        driveSeeded: true,
        pageToken: 'TOKEN_WARM_HEAD',
        appliedFileIds: [],
      });

      const firstTransport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      // Pull 1: 100 of 160 mutations
      const pull1 = await firstTransport.pull(credentials, 0, 100);
      expect(pull1.changes).toHaveLength(100);
      expect(pull1.hasMore).toBe(true);

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, pull1);
      await firstTransport.acknowledgePull(credentials, pull1.receipt!);

      expect(await testDb.drawings.count()).toBe(100);

      // Verify intermediate syncState
      const midState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(midState?.appliedFileIds).not.toContain(fileId);
      expect(midState?.pendingFileProgress).toEqual({
        fileId,
        offset: 100,
        totalMutations: 160,
      });

      // Simulate token expiration (410 Gone)
      expired = true;

      // Restarted transport instance executes pull across 410 recovery
      const restartedTransport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      const tailPull = await restartedTransport.pull(credentials, 100, 100);
      expect(tailPull.changes).toHaveLength(60);
      expect(tailPull.hasMore).toBe(false);

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 100, tailPull);
      await restartedTransport.acknowledgePull(credentials, tailPull.receipt!);

      // Assert complete loss-free convergence to 160 drawings
      expect(await testDb.drawings.count()).toBe(160);

      const finalState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(finalState?.appliedFileIds).toContain(fileId);
      expect(finalState?.pendingFileProgress).toBeUndefined();
      expect(finalState?.lastServerCursor).toBe(160);
    });
  });

  describe('Scenario 8 (Probe 2): Stale acknowledgement regression test', () => {
    it('does not regress newer durable checkpoint when stale delayed receipt ack arrives', async () => {
      const fileId = 'stale-journal-probe';
      const fileHlc = `${isoTime}_0000_peer-stale`;
      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${fileHlc}.json.gz`,
        appProperties: {
          type: 'journal',
          hlc: fileHlc,
          deviceId: 'peer-stale',
        },
      };

      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => [fileMeta]),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'HEAD' })),
        downloadCompressedJson: vi.fn(async () => ({
          hlc: fileHlc,
          deviceId: 'peer-stale',
          createdAt: isoTime,
          mutations: Array.from({ length: 160 }, (_, i) => createDrawingMutation(i)),
        })) as any,
        recover410Cursor: vi.fn(),
      };

      const reconciler = new DexieSyncReconciler(testDb, () => true);

      const staleTransport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      const activeTransport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      // Stale instance pulls 100/160; reconcile succeeds; ack is DELAYED
      const staleBatch = await staleTransport.pull(credentials, 0, 100);
      expect(staleBatch.changes).toHaveLength(100);
      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, staleBatch);

      // Active instance pulls remaining 60, reconciles and acks (marking completed with 160 drawings)
      const lastBatch = await activeTransport.pull(credentials, 100, 100);
      expect(lastBatch.changes).toHaveLength(60);
      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 100, lastBatch);
      await activeTransport.acknowledgePull(credentials, lastBatch.receipt!);

      // Checkpoint before belated stale ack
      const stateBefore = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(stateBefore?.appliedFileIds).toContain(fileId);
      expect(stateBefore?.pendingFileProgress).toBeUndefined();
      expect(stateBefore?.lastServerCursor).toBe(160);
      expect(await testDb.drawings.count()).toBe(160);

      // Belated stale ack is called with old receipt
      await staleTransport.acknowledgePull(credentials, staleBatch.receipt!);

      // Assert state is NOT regressed
      const stateAfter = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(stateAfter?.appliedFileIds).toContain(fileId);
      expect(stateAfter?.pendingFileProgress).toBeUndefined();
      expect(stateAfter?.lastServerCursor).toBe(160);
      expect(await testDb.drawings.count()).toBe(160);
    });
  });

  describe('Scenario 9 (Probe 3): LRU backlog loop with 1200 journals', () => {
    it('delivers all 1200 unique mutations across 12 batches without infinite loop despite MAX_PERSISTED_APPLIED_FILES = 1000', async () => {
      const files: DriveFileMetadata[] = Array.from({ length: 1200 }, (_, i) => {
        const hlc = `${isoTime}_${String(i).padStart(6, '0')}_peer-lru`;
        return {
          id: `file-${i}`,
          name: `journal_${hlc}.json.gz`,
          appProperties: {
            type: 'journal',
            hlc,
            deviceId: 'peer-lru',
          },
        };
      });

      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => files),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'HEAD' })),
        downloadCompressedJson: vi.fn(async (fileId) => {
          const idx = Number((fileId as string).replace('file-', ''));
          const hlc = `${isoTime}_${String(idx).padStart(6, '0')}_peer-lru`;
          return {
            hlc,
            deviceId: 'peer-lru',
            createdAt: isoTime,
            mutations: [createDrawingMutation(idx)],
          };
        }) as any,
        recover410Cursor: vi.fn(),
      };

      const reconciler = new DexieSyncReconciler(testDb, () => true);
      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      let cursor = 0;
      const seen = new Set<string>();
      let hasMore = true;
      let batches = 0;

      while (hasMore && batches < 20) {
        const result = await transport.pull(credentials, cursor, 100);
        for (const c of result.changes) {
          expect(seen.has(c.entityId)).toBe(false);
          seen.add(c.entityId);
        }
        await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, cursor, result);
        await transport.acknowledgePull(credentials, result.receipt!);
        cursor = result.newCursor;
        hasMore = result.hasMore;
        batches++;
      }

      expect(batches).toBe(12);
      expect(hasMore).toBe(false);
      expect(seen.size).toBe(1200);
      expect(await testDb.drawings.count()).toBe(1200);
    });

    it('resumes cleanly across process restart partway through (batch 6) without tail starvation or duplicate re-emissions', async () => {
      const files: DriveFileMetadata[] = Array.from({ length: 1200 }, (_, i) => {
        const hlc = `${isoTime}_${String(i).padStart(6, '0')}_peer-lru`;
        return {
          id: `file-${i}`,
          name: `journal_${hlc}.json.gz`,
          appProperties: {
            type: 'journal',
            hlc,
            deviceId: 'peer-lru',
          },
        };
      });

      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => files),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'HEAD' })),
        downloadCompressedJson: vi.fn(async (fileId) => {
          const idx = Number((fileId as string).replace('file-', ''));
          const hlc = `${isoTime}_${String(idx).padStart(6, '0')}_peer-lru`;
          return {
            hlc,
            deviceId: 'peer-lru',
            createdAt: isoTime,
            mutations: [createDrawingMutation(idx)],
          };
        }) as any,
        recover410Cursor: vi.fn(),
      };

      const reconciler = new DexieSyncReconciler(testDb, () => true);
      let transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      let cursor = 0;
      const seen = new Set<string>();
      let hasMore = true;
      let batches = 0;

      // Run exactly 6 batches (600 mutations)
      while (batches < 6 && hasMore) {
        const result = await transport.pull(credentials, cursor, 100);
        for (const c of result.changes) {
          expect(seen.has(c.entityId)).toBe(false);
          seen.add(c.entityId);
        }
        await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, cursor, result);
        await transport.acknowledgePull(credentials, result.receipt!);
        cursor = result.newCursor;
        hasMore = result.hasMore;
        batches++;
      }

      expect(batches).toBe(6);
      expect(seen.size).toBe(600);
      expect(await testDb.drawings.count()).toBe(600);
      expect(cursor).toBe(600);

      // SIMULATE PROCESS RESTART at batch 6
      transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      // Resume pull with restarted transport
      while (hasMore && batches < 20) {
        const result = await transport.pull(credentials, cursor, 100);
        for (const c of result.changes) {
          expect(seen.has(c.entityId)).toBe(false);
          seen.add(c.entityId);
        }
        await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, cursor, result);
        await transport.acknowledgePull(credentials, result.receipt!);
        cursor = result.newCursor;
        hasMore = result.hasMore;
        batches++;
      }

      expect(batches).toBe(12);
      expect(hasMore).toBe(false);
      expect(seen.size).toBe(1200);
      expect(await testDb.drawings.count()).toBe(1200);
    });

    it('resumes cleanly across process restart after >1000 consumed (batch 11) where files 0..99 are evicted from appliedFileIds without re-emission or starvation', async () => {
      const files: DriveFileMetadata[] = Array.from({ length: 1200 }, (_, i) => {
        const hlc = `${isoTime}_${String(i).padStart(6, '0')}_peer-lru-deep`;
        return {
          id: `file-${i}`,
          name: `journal_${hlc}.json.gz`,
          appProperties: {
            type: 'journal',
            hlc,
            deviceId: 'peer-lru-deep',
          },
        };
      });

      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => files),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'HEAD' })),
        downloadCompressedJson: vi.fn(async (fileId) => {
          const idx = Number((fileId as string).replace('file-', ''));
          const hlc = `${isoTime}_${String(idx).padStart(6, '0')}_peer-lru-deep`;
          return {
            hlc,
            deviceId: 'peer-lru-deep',
            createdAt: isoTime,
            mutations: [createDrawingMutation(idx)],
          };
        }) as any,
        recover410Cursor: vi.fn(),
      };

      const reconciler = new DexieSyncReconciler(testDb, () => true);
      let transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      let cursor = 0;
      const seen = new Set<string>();
      let hasMore = true;
      let batches = 0;

      // Run exactly 11 batches (1100 mutations consumed)
      // At 1100 items, files 0..99 are evicted from the 1000-cap appliedFileIds list in Dexie!
      while (batches < 11 && hasMore) {
        const result = await transport.pull(credentials, cursor, 100);
        for (const c of result.changes) {
          expect(seen.has(c.entityId)).toBe(false);
          seen.add(c.entityId);
        }
        await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, cursor, result);
        await transport.acknowledgePull(credentials, result.receipt!);
        cursor = result.newCursor;
        hasMore = result.hasMore;
        batches++;
      }

      expect(batches).toBe(11);
      expect(seen.size).toBe(1100);
      expect(await testDb.drawings.count()).toBe(1100);
      expect(cursor).toBe(1100);

      // Verify that eviction happened in stored state:
      // stored appliedFileIds contains at most 1000 items, so file-0 is evicted!
      const storedStateBeforeRestart = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(storedStateBeforeRestart?.appliedFileIds?.length).toBeLessThanOrEqual(1000);
      expect(storedStateBeforeRestart?.appliedFileIds).not.toContain('file-0');
      expect(storedStateBeforeRestart?.appliedFileIds).toContain('file-1099');

      // SIMULATE PROCESS RESTART at batch 11 (after >1000 consumed)
      transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      // Resume pull with restarted transport: must finish remaining 100 files without looping
      while (hasMore && batches < 20) {
        const result = await transport.pull(credentials, cursor, 100);
        for (const c of result.changes) {
          expect(seen.has(c.entityId)).toBe(false);
          seen.add(c.entityId);
        }
        await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, cursor, result);
        await transport.acknowledgePull(credentials, result.receipt!);
        cursor = result.newCursor;
        hasMore = result.hasMore;
        batches++;
      }

      expect(batches).toBe(12);
      expect(hasMore).toBe(false);
      expect(seen.size).toBe(1200);
      expect(await testDb.drawings.count()).toBe(1200);
    });

    it('processes equal HLC ties deterministically without skipping any files', async () => {
      // 4 files with identical HLC timestamps
      const tieHlc = `${isoTime}_0000_peer-tied`;
      const files: DriveFileMetadata[] = [
        { id: 'tie-file-1', name: `journal_${tieHlc}.json.gz`, appProperties: { type: 'journal', hlc: tieHlc, deviceId: 'peer-tied' } },
        { id: 'tie-file-2', name: `journal_${tieHlc}.json.gz`, appProperties: { type: 'journal', hlc: tieHlc, deviceId: 'peer-tied' } },
        { id: 'tie-file-3', name: `journal_${tieHlc}.json.gz`, appProperties: { type: 'journal', hlc: tieHlc, deviceId: 'peer-tied' } },
      ];

      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => files),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'HEAD' })),
        downloadCompressedJson: vi.fn(async (fileId) => ({
          hlc: tieHlc,
          deviceId: 'peer-tied',
          createdAt: isoTime,
          mutations: [createDrawingMutation(Number((fileId as string).replace('tie-file-', '')))],
        })) as any,
        recover410Cursor: vi.fn(),
      };

      const reconciler = new DexieSyncReconciler(testDb, () => true);
      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      const pull = await transport.pull(credentials, 0, 100);
      expect(pull.changes).toHaveLength(3);
      const receivedIds = pull.changes.map((c) => c.entityId);
      expect(receivedIds).toContain('draw-id-1');
      expect(receivedIds).toContain('draw-id-2');
      expect(receivedIds).toContain('draw-id-3');

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, pull);
      await transport.acknowledgePull(credentials, pull.receipt!);

      expect(await testDb.drawings.count()).toBe(3);
    });
  });

  describe('Scenario 10: Probe UNACKED_COMPLETED_CANDIDATES & Download Failure Rollback', () => {
    it('redelivers uncommitted candidate file on retry at unchanged cursor on SAME transport instance', async () => {
      // Two journals: 100 + 60 mutations
      const files: DriveFileMetadata[] = [
        { id: 'file-first', name: `journal_${hlcTime}.json.gz`, appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-1' } },
        { id: 'file-second', name: `journal_${hlcTime}.json.gz`, appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-1' } },
      ];

      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => files),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'HEAD' })),
        downloadCompressedJson: vi.fn(async (fileId) => {
          const isFirst = fileId === 'file-first';
          const count = isFirst ? 100 : 60;
          const baseIdx = isFirst ? 0 : 100;
          return {
            hlc: hlcTime,
            deviceId: 'peer-1',
            createdAt: isoTime,
            mutations: Array.from({ length: count }, (_, i) => createDrawingMutation(baseIdx + i)),
          };
        }) as any,
        recover410Cursor: vi.fn(),
      };

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      // First pull: returns 100 mutations (file-first)
      const firstPull = await transport.pull(credentials, 0, 100);
      expect(firstPull.changes).toHaveLength(100);
      expect(firstPull.changes[0].entityId).toBe('draw-id-0');

      // CRITICAL: Caller does NOT commit or acknowledge firstPull.
      // E.g. simulated network abort, reconciler error, or transaction rollback.
      // Caller retries pull at cursor 0 on the SAME transport instance.
      const retriedPull = await transport.pull(credentials, 0, 100);

      // Must REDELIVER file-first starting at draw-id-0, NOT skip to file-second (draw-id-100)!
      expect(retriedPull.changes).toHaveLength(100);
      expect(retriedPull.changes[0].entityId).toBe('draw-id-0');
      expect(retriedPull.changes[99].entityId).toBe('draw-id-99');

      // Now reconcile and acknowledge the retried pull
      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, retriedPull);
      await transport.acknowledgePull(credentials, retriedPull.receipt!);
      expect(await testDb.drawings.count()).toBe(100);

      // Next pull at cursor 100 returns the second file (60 mutations)
      const nextPull = await transport.pull(credentials, retriedPull.newCursor, 100);
      expect(nextPull.changes).toHaveLength(60);
      expect(nextPull.changes[0].entityId).toBe('draw-id-100');
      expect(nextPull.changes[59].entityId).toBe('draw-id-159');

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, retriedPull.newCursor, nextPull);
      await transport.acknowledgePull(credentials, nextPull.receipt!);
      expect(await testDb.drawings.count()).toBe(160);

      // Further pull returns 0 changes
      const emptyPull = await transport.pull(credentials, nextPull.newCursor, 100);
      expect(emptyPull.changes).toHaveLength(0);
      expect(emptyPull.hasMore).toBe(false);
    });

    it('rolls back speculative batch state if download fails midway so previously downloaded file in same batch is redelivered on retry', async () => {
      // Two files: file-1 (50 mutations), file-2 (60 mutations)
      const files: DriveFileMetadata[] = [
        { id: 'fail-file-1', name: `journal_${hlcTime}.json.gz`, appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-1' } },
        { id: 'fail-file-2', name: `journal_${hlcTime}.json.gz`, appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-1' } },
      ];

      let shouldFailFile2 = true;

      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => files),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'HEAD' })),
        downloadCompressedJson: vi.fn(async (fileId) => {
          if (fileId === 'fail-file-1') {
            return {
              hlc: hlcTime,
              deviceId: 'peer-1',
              createdAt: isoTime,
              mutations: Array.from({ length: 50 }, (_, i) => createDrawingMutation(i)),
            };
          }
          if (fileId === 'fail-file-2') {
            if (shouldFailFile2) {
              throw new DriveHttpError('Service Unavailable', 503, 'Backend temporary error');
            }
            return {
              hlc: hlcTime,
              deviceId: 'peer-1',
              createdAt: isoTime,
              mutations: Array.from({ length: 60 }, (_, i) => createDrawingMutation(50 + i)),
            };
          }
          throw new Error(`Unexpected fileId: ${fileId}`);
        }) as any,
        recover410Cursor: vi.fn(),
      };

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      // First pull: downloads fail-file-1 (50 mutations), then attempts to download fail-file-2, which throws 503!
      await expect(transport.pull(credentials, 0, 100)).rejects.toThrow(/Service Unavailable/);

      // Now transient error resolves
      shouldFailFile2 = false;

      // Retry pull on SAME transport instance at cursor 0
      // fail-file-1 MUST be redelivered (not dropped or skipped because it completed download in failed attempt)
      const retryPull = await transport.pull(credentials, 0, 100);

      // With limit 100: fail-file-1 (50) + partial fail-file-2 (50) = 100 changes
      expect(retryPull.changes).toHaveLength(100);
      expect(retryPull.changes[0].entityId).toBe('draw-id-0');
      expect(retryPull.changes[49].entityId).toBe('draw-id-49');
      expect(retryPull.changes[50].entityId).toBe('draw-id-50');

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, retryPull);
      await transport.acknowledgePull(credentials, retryPull.receipt!);

      // Next pull delivers remaining 10 mutations of fail-file-2
      const tailPull = await transport.pull(credentials, retryPull.newCursor, 100);
      expect(tailPull.changes).toHaveLength(10);
      expect(tailPull.changes[0].entityId).toBe('draw-id-100');
      expect(tailPull.changes[9].entityId).toBe('draw-id-109');

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, retryPull.newCursor, tailPull);
      await transport.acknowledgePull(credentials, tailPull.receipt!);

      expect(await testDb.drawings.count()).toBe(110);
    });
  });

  describe('Scenario 11: Probe UNSEEN_OLDER_JOURNAL & Out-of-Order Uploads', () => {
    it('delivers unseen older journal from same peer arriving out-of-order in change feed despite peer watermark', async () => {
      // Warm feed setup (pageToken = 'OLD_TOKEN')
      const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
      await stateRepo.saveSyncState({
        key: tokenKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 0,
        driveSeeded: true,
        pageToken: 'TOKEN_WARM_INIT',
        appliedFileIds: [],
        peerWatermarks: {},
      });

      const laterHlc = `${isoTime}_0001_peer-delayed`;
      const olderHlc = `${isoTime}_0000_peer-delayed`;

      const laterMeta: DriveFileMetadata = {
        id: 'journal-later',
        name: `journal_${laterHlc}.json.gz`,
        appProperties: { type: 'journal', hlc: laterHlc, deviceId: 'peer-delayed' },
      };
      const olderMeta: DriveFileMetadata = {
        id: 'journal-older',
        name: `journal_${olderHlc}.json.gz`,
        appProperties: { type: 'journal', hlc: olderHlc, deviceId: 'peer-delayed' },
      };

      let feedPhase = 0;

      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'TOKEN_START'),
        listFiles: vi.fn(async () => [laterMeta, olderMeta]),
        listChanges: vi.fn(async () => {
          if (feedPhase === 0) {
            return { changes: [{ fileId: laterMeta.id, file: laterMeta }], newStartPageToken: 'HEAD1' };
          }
          return { changes: [{ fileId: olderMeta.id, file: olderMeta }], newStartPageToken: 'HEAD2' };
        }),
        downloadCompressedJson: vi.fn(async (fileId) => {
          if (fileId === 'journal-later') {
            return {
              hlc: laterHlc,
              deviceId: 'peer-delayed',
              createdAt: isoTime,
              mutations: [createDrawingMutation(1)],
            };
          }
          return {
            hlc: olderHlc,
            deviceId: 'peer-delayed',
            createdAt: isoTime,
            mutations: [createDrawingMutation(2)],
          };
        }) as any,
        recover410Cursor: vi.fn(),
      };

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      // Step 1: Pull delivers journal-later
      const firstPull = await transport.pull(credentials, 0, 100);
      expect(firstPull.changes).toHaveLength(1);
      expect(firstPull.changes[0].entityId).toBe('draw-id-1');

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, firstPull);
      await transport.acknowledgePull(credentials, firstPull.receipt!);
      expect(await testDb.drawings.count()).toBe(1);

      // Verify that peer watermark is recorded as laterHlc
      const stateAfterFirst = await stateRepo.getSyncState(tokenKey);
      expect(stateAfterFirst?.pageToken).toBe('HEAD1');
      expect(stateAfterFirst?.peerWatermarks?.['peer-delayed']).toBe(laterHlc);

      // Step 2: feed switches to phase 1, returning olderMeta (HLC 0000, lower than watermark 0001)
      feedPhase = 1;

      // Second pull MUST NOT skip journal-older due to watermark optimization!
      const delayedPull = await transport.pull(credentials, firstPull.newCursor, 100);
      expect(delayedPull.changes).toHaveLength(1);
      expect(delayedPull.changes[0].entityId).toBe('draw-id-2');

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, firstPull.newCursor, delayedPull);
      await transport.acknowledgePull(credentials, delayedPull.receipt!);

      // Both drawings must be persisted in Dexie
      expect(await testDb.drawings.count()).toBe(2);
      const stateAfterDelayed = await stateRepo.getSyncState(tokenKey);
      expect(stateAfterDelayed?.pageToken).toBe('HEAD2');
    });

    it('processes out-of-order journals during cold discovery without skipping lower HLC files', async () => {
      const laterHlc = `${isoTime}_0005_peer-out-of-order`;
      const olderHlc = `${isoTime}_0002_peer-out-of-order`;

      const files: DriveFileMetadata[] = [
        { id: 'cold-later', name: `journal_${laterHlc}.json.gz`, appProperties: { type: 'journal', hlc: laterHlc, deviceId: 'peer-out-of-order' } },
        { id: 'cold-older', name: `journal_${olderHlc}.json.gz`, appProperties: { type: 'journal', hlc: olderHlc, deviceId: 'peer-out-of-order' } },
      ];

      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => files),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'HEAD' })),
        downloadCompressedJson: vi.fn(async (fileId) => ({
          hlc: fileId === 'cold-later' ? laterHlc : olderHlc,
          deviceId: 'peer-out-of-order',
          createdAt: isoTime,
          mutations: [createDrawingMutation(fileId === 'cold-later' ? 10 : 20)],
        })) as any,
        recover410Cursor: vi.fn(),
      };

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      const pull = await transport.pull(credentials, 0, 100);
      expect(pull.changes).toHaveLength(2);
      const entityIds = pull.changes.map((c) => c.entityId);
      expect(entityIds).toContain('draw-id-10');
      expect(entityIds).toContain('draw-id-20');

      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, pull);
      await transport.acknowledgePull(credentials, pull.receipt!);

      expect(await testDb.drawings.count()).toBe(2);
    });
  });

  describe('Scenario 13: Push / Baseline saveState Concurrency with Pull Checkpoint', () => {
    it('preserves advanced pull checkpoint when concurrent push saveState completes', async () => {
      const tokenKey = `${credentials.userId}:${credentials.deviceId}`;

      // Simulate a scenario where transport pull advances the checkpoint in Dexie
      // Pull advances cursor to 150, pageToken to 'PULL_ADVANCED_TOKEN', appliedFileIds to ['journal-p1']
      const advancedPullState = {
        key: tokenKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 150,
        pageToken: 'PULL_ADVANCED_TOKEN',
        appliedFileIds: ['journal-p1'],
        pendingFileProgress: { fileId: 'journal-partial', offset: 50, totalMutations: 100 },
        peerWatermarks: { 'peer-1': `${isoTime}_0010_peer-1` },
        driveSeeded: true,
      };

      // Create a transport instance for push
      const pushTransport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: mockDriveClient,
        authService: mockAuthService,
      });

      // Hook updateSyncState on stateRepo to simulate race condition:
      // Suspend push write, advance pull checkpoint, then release push write.
      let releasePush: () => void;
      const pushSuspendedPromise = new Promise<void>((resolve) => {
        releasePush = resolve;
      });

      const origUpdate = stateRepo.updateSyncState!.bind(stateRepo);
      let pushSuspended = false;
      vi.spyOn(stateRepo, 'updateSyncState').mockImplementation(async (key, updater) => {
        if (!pushSuspended) {
          pushSuspended = true;
          // Suspend push write until pull checkpoint advances
          await pushSuspendedPromise;
        }
        return origUpdate(key, updater);
      });

      // Start push saveState in background (it will suspend before committing)
      const pushPromise = (pushTransport as any).saveStateForCredentials(credentials);

      // Advance pull checkpoint while push write is suspended
      await origUpdate(tokenKey, () => advancedPullState);

      // Release push write
      releasePush!();
      await pushPromise;

      const finalState = await stateRepo.getSyncState(tokenKey);
      // Assert: advanced cursor is preserved (150, not 0)
      expect(finalState?.lastServerCursor).toBe(150);
      // Assert: advanced pageToken is preserved
      expect(finalState?.pageToken).toBe('PULL_ADVANCED_TOKEN');
      // Assert: pendingFileProgress is preserved
      expect(finalState?.pendingFileProgress).toEqual({ fileId: 'journal-partial', offset: 50, totalMutations: 100 });
      // Assert: appliedFileIds includes pull's applied file
      expect(finalState?.appliedFileIds).toContain('journal-p1');
    });
  });

  describe('Scenario 14: Pre-write CAS, Staleness Fencing & Duplicate Ack', () => {
    it('fences stale instance attempting to commit older batch after newer batch committed', async () => {
      // Instance A pulls at cursor 0 -> newCursor 50
      // Instance B pulls at cursor 50 -> newCursor 100 and commits
      const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
      await stateRepo.saveSyncState({
        key: tokenKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 100,
        driveSeeded: true,
        appliedFileIds: ['journal-b'],
      });

      // Instance A has stale response with newCursor 50 (base cursor 0)
      const stalePullResponse = {
        newCursor: 50,
        hasMore: false,
        changes: [
          {
            sequence: 1,
            changedAt: isoTime,
            entityType: 'drawing',
            entityId: 'draw-stale-attempt',
            operation: 'UPSERT' as const,
            data: {
              id: 'draw-stale-attempt',
              documentId: 'doc-stale',
              points: [],
              color: 'black',
              thickness: 1,
              createdAt: isoTime,
            },
          },
        ],
        receipt: {
          receiptId: 'receipt-stale',
          userId: credentials.userId,
          deviceId: credentials.deviceId,
          appliedFileIds: ['journal-stale'],
        },
      };

      // Reconciler should detect that base cursor (0) or newCursor (50) is stale relative to stored cursor (100)
      const result = await reconciler.reconcilePullBatch(
        credentials.userId,
        credentials.deviceId,
        0, // base cursor is 0 while DB is at 100
        stalePullResponse
      );

      // Verify entities from stale batch were NOT applied to drawings table
      expect(await testDb.drawings.get('draw-stale-attempt')).toBeUndefined();
      expect(result.appliedCount).toBe(0);

      // Verify stored syncState was NOT regressed
      const stateAfter = await stateRepo.getSyncState(tokenKey);
      expect(stateAfter?.lastServerCursor).toBe(100);
      expect(stateAfter?.appliedFileIds).not.toContain('journal-stale');
    });

    it('fences receipt when base cursor does not match stored cursor even if newCursor equals stored cursor', async () => {
      const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
      await stateRepo.saveSyncState({
        key: tokenKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 100,
        driveSeeded: true,
        appliedFileIds: ['journal-current'],
      });

      // Batch with baseCursor = 50, but newCursor = 100 (matching stored cursor)
      const mismatchedBaseResponse = {
        newCursor: 100,
        hasMore: false,
        changes: [
          {
            sequence: 1,
            changedAt: isoTime,
            entityType: 'drawing',
            entityId: 'draw-mismatched-base',
            operation: 'UPSERT' as const,
            data: {
              id: 'draw-mismatched-base',
              documentId: 'doc-mismatched',
              points: [],
              color: 'blue',
              thickness: 1,
              createdAt: isoTime,
            },
          },
        ],
        receipt: {
          receiptId: 'receipt-mismatched-base',
          userId: credentials.userId,
          deviceId: credentials.deviceId,
          appliedFileIds: ['journal-mismatched'],
        },
      };

      const result = await reconciler.reconcilePullBatch(
        credentials.userId,
        credentials.deviceId,
        50, // base cursor 50 does not match stored cursor 100
        mismatchedBaseResponse
      );

      // Verify entities were fenced and not applied
      expect(await testDb.drawings.get('draw-mismatched-base')).toBeUndefined();
      expect(result.appliedCount).toBe(0);

      const stateAfter = await stateRepo.getSyncState(tokenKey);
      expect(stateAfter?.lastServerCursor).toBe(100);
      expect(stateAfter?.appliedFileIds).not.toContain('journal-mismatched');
    });

    it('fences receipt when receipt user or device does not match session credentials', async () => {
      const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
      await stateRepo.saveSyncState({
        key: tokenKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 10,
        driveSeeded: true,
      });

      const foreignReceiptResponse = {
        newCursor: 20,
        hasMore: false,
        changes: [
          {
            sequence: 1,
            changedAt: isoTime,
            entityType: 'drawing',
            entityId: 'draw-foreign-user',
            operation: 'UPSERT' as const,
            data: {
              id: 'draw-foreign-user',
              documentId: 'doc-foreign',
              points: [],
              color: 'red',
              thickness: 1,
              createdAt: isoTime,
            },
          },
        ],
        receipt: {
          receiptId: 'receipt-foreign',
          userId: 'foreign-attacker-user',
          deviceId: 'foreign-attacker-device',
          appliedFileIds: ['journal-foreign'],
        },
      };

      await expect(
        reconciler.reconcilePullBatch(
          credentials.userId,
          credentials.deviceId,
          10,
          foreignReceiptResponse
        )
      ).rejects.toThrow(/Receipt user mismatch/);

      // Verify foreign receipt was fenced / rejected
      expect(await testDb.drawings.get('draw-foreign-user')).toBeUndefined();

      const stateAfter = await stateRepo.getSyncState(tokenKey);
      expect(stateAfter?.lastServerCursor).toBe(10);
      expect(stateAfter?.appliedFileIds ?? []).not.toContain('journal-foreign');
    });

    it('idempotently handles duplicate acknowledgePull calls without error or state corruption', async () => {
      const files: DriveFileMetadata[] = [
        { id: 'dup-ack-file', name: `journal_${hlcTime}.json.gz`, appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-1' } },
      ];

      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => files),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'HEAD' })),
        downloadCompressedJson: vi.fn(async () => ({
          hlc: hlcTime,
          deviceId: 'peer-1',
          createdAt: isoTime,
          mutations: [createDrawingMutation(1)],
        })) as any,
        recover410Cursor: vi.fn(),
      };

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      const pull = await transport.pull(credentials, 0, 100);
      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, pull);

      // First ack: succeeds
      await transport.acknowledgePull(credentials, pull.receipt!);

      const stateAfterFirstAck = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);

      // Second duplicate ack with same receipt: must succeed cleanly without error
      await expect(transport.acknowledgePull(credentials, pull.receipt!)).resolves.not.toThrow();

      const stateAfterSecondAck = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(stateAfterSecondAck?.lastServerCursor).toBe(stateAfterFirstAck?.lastServerCursor);
      expect(stateAfterSecondAck?.appliedFileIds).toEqual(stateAfterFirstAck?.appliedFileIds);
    });
  });

  describe('Scenario 15: Checkpoint Revision & Authoritative Ack Guardrails (R5/R6 Spec Compliance)', () => {
    it('rejects stale older empty batch when newer empty batch commits first (Probe EMPTY_BATCH_FRESHNESS)', async () => {
      // Warm state setup
      await stateRepo.saveSyncState({
        key: `${credentials.userId}:${credentials.deviceId}`,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 0,
        driveSeeded: true,
        pageToken: 'TOKEN_START',
        appliedFileIds: [],
        checkpointRevision: 0,
      });

      let feedToken = 'HEAD1';
      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => []),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: feedToken })),
        downloadCompressedJson: vi.fn(),
        recover410Cursor: vi.fn(),
      };

      const reconciler = new DexieSyncReconciler(testDb, () => true);

      // Two actual transport instances pulling at cursor 0
      const transportA = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });
      const transportB = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      // Transport A pulls when token is HEAD1
      const older = await transportA.pull(credentials, 0, 100);
      expect(older.changes).toHaveLength(0);
      expect(older.receipt?.pageToken).toBe('HEAD1');
      expect(older.receipt?.baseCursor).toBe(0);

      // Feed advances to HEAD2
      feedToken = 'HEAD2';

      // Transport B pulls when token is HEAD2
      const newer = await transportB.pull(credentials, 0, 100);
      expect(newer.changes).toHaveLength(0);
      expect(newer.receipt?.pageToken).toBe('HEAD2');
      expect(newer.receipt?.baseCursor).toBe(0);

      // Newer batch commits first
      const newerResult = await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, newer);
      expect(newerResult.isStale).toBeFalsy();
      await transportB.acknowledgePull(credentials, newer.receipt!);

      const stateBeforeOld = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(stateBeforeOld?.pageToken).toBe('HEAD2');
      expect(stateBeforeOld?.checkpointRevision).toBe(1);

      // Older batch (which had baseRevision 0) attempts to commit
      const olderResult = await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, older);

      // Invariant: older batch MUST be rejected because storedRevision is now 1, not 0!
      expect(olderResult.isStale).toBe(true);

      const stateAfterOld = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      // Invariant: pageToken must NOT regress to HEAD1!
      expect(stateAfterOld?.pageToken).toBe('HEAD2');
      expect(stateAfterOld?.checkpointRevision).toBe(1);
      expect(stateAfterOld?.lastServerCursor).toBe(0);
    });

    it('does NOT modify RAM caches or skip records when an uncommitted receipt is passed to acknowledgePull', async () => {
      const fileId = 'journal-uncommitted-ack';
      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-1' },
      };

      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => [fileMeta]),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'HEAD' })),
        downloadCompressedJson: vi.fn(async () => ({
          hlc: hlcTime,
          deviceId: 'peer-1',
          createdAt: isoTime,
          mutations: [createDrawingMutation(1)],
        })) as any,
        recover410Cursor: vi.fn(),
      };

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      // Pull 1: returns 1 change from journal-uncommitted-ack
      const pull = await transport.pull(credentials, 0, 100);
      expect(pull.changes).toHaveLength(1);
      expect(pull.receipt).toBeDefined();

      // CRITICAL: We intentionally do NOT call reconciler.reconcilePullBatch!
      // The receipt is UNCOMMITTED in durable storage.
      // Now attempt acknowledgePull with this uncommitted receipt.
      await transport.acknowledgePull(credentials, pull.receipt!);

      // Invariant: in-memory appliedFileIds MUST NOT adopt fileId from uncommitted receipt!
      expect(transport.getAppliedFileIds().has(fileId)).toBe(false);

      // Invariant: durable syncState must NOT contain fileId
      const persisted = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(persisted?.appliedFileIds ?? []).not.toContain(fileId);

      // On next pull at cursor 0: fileId is NOT skipped! It is pulled again.
      const retryPull = await transport.pull(credentials, 0, 100);
      expect(retryPull.changes).toHaveLength(1);
      expect(retryPull.changes[0].entityId).toBe('draw-id-1');
    });

    it('does NOT poison RAM caches if stateRepo.getSyncState throws during acknowledgePull', async () => {
      const fileId = 'journal-fail-read-ack';
      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-1' },
      };

      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => [fileMeta]),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'HEAD' })),
        downloadCompressedJson: vi.fn(async () => ({
          hlc: hlcTime,
          deviceId: 'peer-1',
          createdAt: isoTime,
          mutations: [createDrawingMutation(1)],
        })) as any,
        recover410Cursor: vi.fn(),
      };

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      const pull = await transport.pull(credentials, 0, 100);
      const reconciler = new DexieSyncReconciler(testDb, () => true);
      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, pull);

      // Simulate read failure during acknowledgePull
      let shouldFail = true;
      const origGet = stateRepo.getSyncState.bind(stateRepo);
      vi.spyOn(stateRepo, 'getSyncState').mockImplementation(async (key) => {
        if (shouldFail) {
          throw new Error('Simulated IndexedDB read error in getSyncState');
        }
        return origGet(key);
      });

      // acknowledgePull must throw when durable read fails
      await expect(transport.acknowledgePull(credentials, pull.receipt!)).rejects.toThrow(
        /Simulated IndexedDB read error/
      );

      // Memory state is not poisoned
      expect(transport.getAppliedFileIds().has(fileId)).toBe(false);

      // Clear simulated failure
      shouldFail = false;

      // Retry acknowledgePull: succeeds cleanly and adopts committed state
      await expect(transport.acknowledgePull(credentials, pull.receipt!)).resolves.not.toThrow();
      expect(transport.getAppliedFileIds().has(fileId)).toBe(true);
    });

    it('rejects cleanly without adopting unconfirmed progress when abort/disposal occurs during acknowledgePull', async () => {
      const fileId = 'journal-abort-during-ack';
      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-1' },
      };

      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => [fileMeta]),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'HEAD' })),
        downloadCompressedJson: vi.fn(async () => ({
          hlc: hlcTime,
          deviceId: 'peer-1',
          createdAt: isoTime,
          mutations: [createDrawingMutation(1)],
        })) as any,
        recover410Cursor: vi.fn(),
      };

      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      const pull = await transport.pull(credentials, 0, 100);
      const reconciler = new DexieSyncReconciler(testDb, () => true);
      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, pull);

      const abortController = new AbortController();

      // Hook getSyncState to abort controller during await
      const origGet = stateRepo.getSyncState.bind(stateRepo);
      vi.spyOn(stateRepo, 'getSyncState').mockImplementation(async (key) => {
        abortController.abort(new Error('Abort during acknowledgePull await'));
        return origGet(key);
      });

      await expect(
        transport.acknowledgePull(credentials, pull.receipt!, abortController.signal)
      ).rejects.toThrow(/abort/i);

      // Memory state must not have adopted unconfirmed state
      expect(transport.getAppliedFileIds().has(fileId)).toBe(false);
    });

    it('advances checkpointRevision across consecutive pull iterations with metadata-only batches', async () => {
      await stateRepo.saveSyncState({
        key: `${credentials.userId}:${credentials.deviceId}`,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 0,
        driveSeeded: true,
        pageToken: 'PAGE_0',
        appliedFileIds: [],
        checkpointRevision: 0,
      });

      let pageToken = 'PAGE_1';
      const drive: GoogleDrivePort = {
        generateFileId: vi.fn(async () => 'gen-id'),
        uploadFile: vi.fn(),
        downloadFile: vi.fn(),
        downloadBinary: vi.fn(),
        deleteFile: vi.fn(),
        getStartPageToken: vi.fn(async () => 'START'),
        listFiles: vi.fn(async () => []),
        listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: pageToken })),
        downloadCompressedJson: vi.fn(),
        recover410Cursor: vi.fn(),
      };

      const reconciler = new DexieSyncReconciler(testDb, () => true);
      const transport = new GoogleDriveSyncTransport({
        db: testDb,
        stateRepo,
        driveClient: drive,
        authService: mockAuthService,
      });

      // Iteration 1
      pageToken = 'PAGE_1';
      const pull1 = await transport.pull(credentials, 0, 100);
      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, pull1);
      await transport.acknowledgePull(credentials, pull1.receipt!);

      const state1 = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(state1?.checkpointRevision).toBe(1);
      expect(state1?.pageToken).toBe('PAGE_1');

      // Iteration 2
      pageToken = 'PAGE_2';
      const pull2 = await transport.pull(credentials, 0, 100);
      expect(pull2.receipt?.baseRevision).toBe(1);
      await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, pull2);
      await transport.acknowledgePull(credentials, pull2.receipt!);

      const state2 = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(state2?.checkpointRevision).toBe(2);
      expect(state2?.pageToken).toBe('PAGE_2');
    });
  });
});
