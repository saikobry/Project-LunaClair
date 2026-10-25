import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../../infrastructure/database/schema/LunaClairDatabase';
import { DexieSyncReconciler } from '../../../infrastructure/database/sync/DexieSyncReconciler';
import { DexieSyncQueueRepository } from '../../../infrastructure/database/repositories/DexieSyncQueueRepository';
import { DexieSyncStateRepository } from '../../../infrastructure/database/repositories/DexieSyncStateRepository';
import { GoogleDriveSyncTransport } from '../../../infrastructure/api/transports/GoogleDriveSyncTransport';
import { SyncEngine } from '../SyncEngine';
import { SyncStatusStore } from '../SyncStatusStore';
import type {
  GoogleDrivePort,
  DriveFileMetadata,
} from '../../../domain/drive/models/drive.types';
import type { GoogleAuthPort } from '../../../domain/auth/models/auth.types';
import type {
  SessionCredentials,
  SyncMutation,
} from '../../../domain/sync/models/sync.types';

describe('SyncEngine Pull Durability & Checkpoint Convergence (R5/R6 Integration)', () => {
  const credentials: SessionCredentials = {
    userId: 'user-engine-durability',
    deviceId: 'device-engine-durability',
    token: 'auth-token',
  };

  const isoTime = '2026-10-25T11:00:00.000Z';
  const hlcTime = `${isoTime}_0000_peer-engine`;

  let testDb: LunaClairDatabase;
  let reconciler: DexieSyncReconciler;
  let queueRepo: DexieSyncQueueRepository;
  let stateRepo: DexieSyncStateRepository;
  let statusStore: SyncStatusStore;
  let mockDriveClient: GoogleDrivePort;
  let mockAuthService: GoogleAuthPort;

  const createDrawingMutation = (index: number, documentId = 'doc-test-1'): SyncMutation => ({
    clientMutationId: `m_draw_${index}`,
    entityType: 'drawing',
    entityId: `draw_${index}`,
    operation: 'UPSERT',
    clientTimestamp: isoTime,
    payload: {
      id: `draw_${index}`,
      documentId,
      color: '#ff0055',
      thickness: 3,
      points: [
        { x: 0.05 * index, y: 0.1 },
        { x: 0.05 * index + 0.1, y: 0.3 },
      ],
      createdAt: isoTime,
    },
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    testDb = new LunaClairDatabase(`test-syncengine-durability-${crypto.randomUUID()}`);
    await testDb.open();

    reconciler = new DexieSyncReconciler(testDb, () => true);
    queueRepo = new DexieSyncQueueRepository(testDb);
    stateRepo = new DexieSyncStateRepository(testDb);
    statusStore = new SyncStatusStore();

    // Initial syncState: clean seeded state
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
      getValidAccessToken: vi.fn(async () => 'valid-access-token-456'),
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
      listChanges: vi.fn(async () => ({ changes: [], newStartPageToken: 'TOKEN_NEXT' })),
      recover410Cursor: vi.fn(async () => ({ newPageToken: 'TOKEN_RECOVERED', missingFiles: [] })),
      uploadCompressedJson: vi.fn(async () => ({ id: 'uploaded-journal-id', name: 'uploaded-journal' }) as any),
      downloadCompressedJson: vi.fn(async () => ({
        hlc: hlcTime,
        deviceId: 'peer-engine',
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

  function createEngine(driveClient = mockDriveClient) {
    const transport = new GoogleDriveSyncTransport({
      db: testDb,
      stateRepo,
      driveClient,
      authService: mockAuthService,
    });

    const engine = new SyncEngine({
      transport,
      reconciler,
      queueRepo,
      stateRepo,
      statusStore,
    });

    return { transport, engine };
  }

  describe('Scenario 1: >100 operations in one journal (160 and 194 mutations)', () => {
    it('synchronizes all 160 drawings across multiple 100-limit pull iterations without loss', async () => {
      const totalMutations = 160;
      const fileId = 'journal-160-drawings';
      const mutations = Array.from({ length: totalMutations }, (_, i) => createDrawingMutation(i));

      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-engine' },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([fileMeta]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-engine',
        createdAt: isoTime,
        mutations,
      });

      const { engine } = createEngine();

      // Execute full sync cycle
      await engine.sync(credentials);

      // Verify all 160 drawings are committed to Dexie
      const storedCount = await testDb.drawings.count();
      expect(storedCount).toBe(160);

      // Verify specific drawings (start, boundary, end)
      const firstDraw = await testDb.drawings.get('draw_0');
      expect(firstDraw).toBeDefined();
      expect(firstDraw?.color).toBe('#ff0055');

      const boundaryDraw = await testDb.drawings.get('draw_99');
      expect(boundaryDraw).toBeDefined();

      const lastDraw = await testDb.drawings.get('draw_159');
      expect(lastDraw).toBeDefined();

      // Verify sync state in Dexie
      const finalState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(finalState?.lastServerCursor).toBe(160);
      expect(finalState?.appliedFileIds).toContain(fileId);
      expect(finalState?.pendingFileProgress).toBeUndefined();

      // Second sync cycle: must find no new changes, drawing count remains exactly 160
      await engine.sync(credentials);
      expect(await testDb.drawings.count()).toBe(160);
    });

    it('synchronizes 194 mutations completely without dropping tail mutations', async () => {
      const totalMutations = 194;
      const fileId = 'journal-194-drawings';
      const mutations = Array.from({ length: totalMutations }, (_, i) => createDrawingMutation(i));

      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-engine' },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([fileMeta]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-engine',
        createdAt: isoTime,
        mutations,
      });

      const { engine } = createEngine();

      await engine.sync(credentials);

      expect(await testDb.drawings.count()).toBe(194);
      const finalState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(finalState?.lastServerCursor).toBe(194);
      expect(finalState?.appliedFileIds).toContain(fileId);
      expect(finalState?.pendingFileProgress).toBeUndefined();
    });
  });

  describe('Scenario 2: Multiple journals aggregating >100 mutations (40 + 50 + 30)', () => {
    it('applies all 120 mutations across multiple journals with partial file split', async () => {
      const j1 = Array.from({ length: 40 }, (_, i) => createDrawingMutation(i));
      const j2 = Array.from({ length: 50 }, (_, i) => createDrawingMutation(40 + i));
      const j3 = Array.from({ length: 30 }, (_, i) => createDrawingMutation(90 + i));

      const files: DriveFileMetadata[] = [
        { id: 'j-1', name: 'j1.json.gz', appProperties: { type: 'journal', hlc: hlcTime } },
        { id: 'j-2', name: 'j2.json.gz', appProperties: { type: 'journal', hlc: hlcTime } },
        { id: 'j-3', name: 'j3.json.gz', appProperties: { type: 'journal', hlc: hlcTime } },
      ];

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue(files);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockImplementation(async (fileId) => {
        if (fileId === 'j-1') return { hlc: hlcTime, deviceId: 'peer-engine', createdAt: isoTime, mutations: j1 };
        if (fileId === 'j-2') return { hlc: hlcTime, deviceId: 'peer-engine', createdAt: isoTime, mutations: j2 };
        if (fileId === 'j-3') return { hlc: hlcTime, deviceId: 'peer-engine', createdAt: isoTime, mutations: j3 };
        throw new Error(`Unexpected ${fileId}`);
      });

      const { engine } = createEngine();
      await engine.sync(credentials);

      expect(await testDb.drawings.count()).toBe(120);

      const finalState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(finalState?.lastServerCursor).toBe(120);
      expect(finalState?.appliedFileIds).toContain('j-1');
      expect(finalState?.appliedFileIds).toContain('j-2');
      expect(finalState?.appliedFileIds).toContain('j-3');
      expect(finalState?.pendingFileProgress).toBeUndefined();
    });
  });

  describe('Scenario 3: Interruption / Crash Before Reconcile (R6 regression)', () => {
    it('preserves remote journal for next sync when interrupted prior to reconciliation', async () => {
      const fileId = 'journal-crash-pre-reconcile';
      const mutations = [createDrawingMutation(1), createDrawingMutation(2), createDrawingMutation(3)];

      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-engine' },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([fileMeta]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-engine',
        createdAt: isoTime,
        mutations,
      });

      const { transport } = createEngine();

      // Simulate pull happening
      const pullResult = await transport.pull(credentials, 0, 100);
      expect(pullResult.changes).toHaveLength(3);

      // Verify that pull DID NOT commit appliedFileIds to Dexie
      const midState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(midState?.appliedFileIds ?? []).not.toContain(fileId);
      expect(await testDb.drawings.count()).toBe(0);

      // Application restarts with new engine + transport
      const { engine: restartedEngine } = createEngine();
      await restartedEngine.sync(credentials);

      // Drawings are stored cleanly
      expect(await testDb.drawings.count()).toBe(3);
      const endState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(endState?.appliedFileIds).toContain(fileId);
    });
  });

  describe('Scenario 4: Reconcile Rejection / Transaction Rollback', () => {
    it('rolls back cleanly on reconciler error and succeeds on subsequent retry', async () => {
      const fileId = 'journal-rollback-test';
      const mutations = [createDrawingMutation(1), createDrawingMutation(2)];

      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-engine' },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([fileMeta]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-engine',
        createdAt: isoTime,
        mutations,
      });

      // Flaky reconciler: fails on first attempt
      let shouldFail = true;
      const originalReconcile = reconciler.reconcilePullBatch.bind(reconciler);
      vi.spyOn(reconciler, 'reconcilePullBatch').mockImplementation(async (...args) => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error('Simulated transient DB error during reconcilePullBatch');
        }
        return originalReconcile(...args);
      });

      const { engine } = createEngine();

      // First sync fails in reconciler
      await engine.sync(credentials);
      expect(statusStore.getState().state).toBe('error');
      expect(statusStore.getState().lastError).toContain('Simulated transient DB error');

      // Verify Dexie state is untouched
      expect(await testDb.drawings.count()).toBe(0);
      const stateAfterFail = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(stateAfterFail?.appliedFileIds ?? []).not.toContain(fileId);
      expect(stateAfterFail?.lastServerCursor).toBe(0);

      // Second sync retries cleanly
      await engine.sync(credentials);

      // Verify all drawings now committed
      expect(await testDb.drawings.count()).toBe(2);
      const stateAfterRetry = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(stateAfterRetry?.appliedFileIds).toContain(fileId);
      expect(stateAfterRetry?.lastServerCursor).toBe(2);
      expect(statusStore.getState().state).toBe('idle');
    });
  });

  describe('Scenario 5: Partial File Resumption After Crash', () => {
    it('resumes partial file at offset 100 across crash boundary to store all 160 drawings', async () => {
      const fileId = 'journal-partial-resumption';
      const totalMutations = 160;
      const mutations = Array.from({ length: totalMutations }, (_, i) => createDrawingMutation(i));

      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-engine' },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([fileMeta]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-engine',
        createdAt: isoTime,
        mutations,
      });

      // Step 1: Simulate first batch of 100 having been reconciled and saved to Dexie
      const firstBatch = mutations.slice(0, 100);
      const pullResponse1 = {
        newCursor: 100,
        hasMore: true,
        changes: firstBatch.map((m, idx) => ({
          sequence: idx + 1,
          entityType: m.entityType,
          entityId: m.entityId,
          operation: m.operation,
          changedAt: m.clientTimestamp,
          data: m.payload,
        })),
        receipt: {
          receiptId: 'r-1',
          userId: credentials.userId,
          deviceId: credentials.deviceId,
          appliedFileIds: [],
          pendingFileProgress: {
            fileId,
            offset: 100,
            totalMutations: 160,
          },
        },
      };

      await reconciler.reconcilePullBatch(
        credentials.userId,
        credentials.deviceId,
        0,
        pullResponse1
      );

      // Confirm 100 drawings are in Dexie
      expect(await testDb.drawings.count()).toBe(100);
      const midState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(midState?.pendingFileProgress).toEqual({
        fileId,
        offset: 100,
        totalMutations: 160,
      });

      // Step 2: Crash occurs. Now fresh engine starts up and performs sync
      const { engine } = createEngine();
      await engine.sync(credentials);

      // Verify total drawings is 160 (100 from batch 1 + 60 from resumed batch 2)
      expect(await testDb.drawings.count()).toBe(160);

      const finalState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(finalState?.lastServerCursor).toBe(160);
      expect(finalState?.appliedFileIds).toContain(fileId);
      expect(finalState?.pendingFileProgress).toBeUndefined();
    });
  });

  describe('Scenario 6: Cancellation and Abort Signal', () => {
    it('aborts cleanly when sync is paused/aborted during pull phase without state corruption', async () => {
      let engineRef: SyncEngine | undefined;

      vi.mocked(mockDriveClient.listFiles).mockImplementation(async () => {
        // Abort in-flight sync cycle via engine.pause()
        engineRef?.pause(credentials.userId);
        return [
          { id: 'j-abort', name: 'abort.json.gz', appProperties: { type: 'journal', hlc: hlcTime } },
        ];
      });

      const { engine } = createEngine();
      engineRef = engine;

      await engine.sync(credentials);

      // Confirm database state is clean: aborted remote file was never applied
      expect(await testDb.drawings.count()).toBe(0);
      const state = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(state?.appliedFileIds ?? []).not.toContain('j-abort');
      expect(statusStore.getState().state).toBe('paused');
    });
  });

  describe('Scenario 7: External Abort Signal Isolation across Runs', () => {
    it('does not cancel subsequent sync runs when a previous run signal is aborted after completion', async () => {
      let cycle = 0;
      vi.mocked(mockDriveClient.listFiles).mockImplementation(async () => {
        cycle++;
        const fileHlc = `${isoTime}_000${cycle}_peer-engine`;
        return [
          {
            id: `j-run-${cycle}`,
            name: `journal_${fileHlc}.json.gz`,
            appProperties: { type: 'journal', hlc: fileHlc, deviceId: 'peer-engine' },
          },
        ];
      });

      vi.mocked(mockDriveClient.downloadCompressedJson!).mockImplementation(async (fileId) => {
        const id = fileId as string;
        const num = id.endsWith('1') ? 1 : 2;
        return {
          hlc: `${isoTime}_000${num}_peer-engine`,
          deviceId: 'peer-engine',
          createdAt: isoTime,
          mutations: [createDrawingMutation(num)],
        };
      });

      const { engine } = createEngine();

      // Run A: starts with controllerA signal and completes normally
      const controllerA = new AbortController();
      await engine.sync(credentials, { signal: controllerA.signal });

      expect(await testDb.drawings.count()).toBe(1);
      expect(statusStore.getState().state).toBe('idle');

      // Setup Run B (which does warm sync via listChanges)
      const run2Hlc = `${isoTime}_0002_peer-engine`;
      vi.mocked(mockDriveClient.listChanges).mockResolvedValue({
        changes: [
          {
            fileId: 'j-run-2',
            file: {
              id: 'j-run-2',
              name: `journal_${run2Hlc}.json.gz`,
              appProperties: { type: 'journal', hlc: run2Hlc, deviceId: 'peer-engine' },
            },
          },
        ],
        newStartPageToken: 'TOKEN_NEXT_2',
      });

      // Setup Run B to abort controllerA while Run B is in-flight
      let controllerAAbortedDuringRunB = false;
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockImplementation(async (_fileId) => {
        controllerAAbortedDuringRunB = true;
        // Abort previous completed run's controller
        controllerA.abort(new Error('Controller A post-run cancellation'));
        return {
          hlc: `${isoTime}_0002_peer-engine`,
          deviceId: 'peer-engine',
          createdAt: isoTime,
          mutations: [createDrawingMutation(2)],
        };
      });

      // Run B: starts its own execution with controllerB
      const controllerB = new AbortController();
      await engine.sync(credentials, { signal: controllerB.signal });

      // Run B must have completed successfully despite controllerA aborting!
      expect(controllerAAbortedDuringRunB).toBe(true);
      expect(await testDb.drawings.count()).toBe(2);
      expect(statusStore.getState().state).toBe('idle');
      expect(statusStore.getState().lastError).toBeUndefined();
    });
  });

  describe('Scenario 8: Real Dexie Transaction Atomicity & Crash Recovery', () => {
    it('rolls back both entity writes and checkpoint updates atomically on failure inside real Dexie transaction', async () => {
      const fileId = 'journal-atomic-rollback';
      const mutations = [createDrawingMutation(1), createDrawingMutation(2)];

      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-engine' },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([fileMeta]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-engine',
        createdAt: isoTime,
        mutations,
      });

      // Inject actual failure inside real Dexie transaction when writing syncState
      // (entities have already been placed in the transaction before syncState commit)
      let failInsideTx = true;
      testDb.syncState.hook('updating', function () {
        if (failInsideTx) {
          throw new Error('Simulated Dexie transaction crash during syncState commit');
        }
      });
      testDb.syncState.hook('creating', function () {
        if (failInsideTx) {
          throw new Error('Simulated Dexie transaction crash during syncState commit');
        }
      });

      const { engine } = createEngine();

      // First sync fails inside real Dexie transaction
      await engine.sync(credentials);
      expect(statusStore.getState().state).toBe('error');
      expect(statusStore.getState().lastError).toContain('Simulated Dexie transaction crash');

      // Verify that BOTH entity writes AND checkpoint updates rolled back atomically:
      // 0 drawings, 0 applied files, cursor remains 0
      expect(await testDb.drawings.count()).toBe(0);
      const stateAfterRollback = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(stateAfterRollback?.appliedFileIds ?? []).not.toContain(fileId);
      expect(stateAfterRollback?.lastServerCursor).toBe(0);

      // Clear the injected failure
      failInsideTx = false;

      // Retry on SAME engine instance
      await engine.sync(credentials);

      // Verify clean recovery and persistence
      expect(await testDb.drawings.count()).toBe(2);
      const stateAfterRetry = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(stateAfterRetry?.appliedFileIds).toContain(fileId);
      expect(stateAfterRetry?.lastServerCursor).toBe(2);
      expect(statusStore.getState().state).toBe('idle');

      // Retry on NEW engine instance: converges cleanly without duplicate writes
      const { engine: newEngine } = createEngine();
      await newEngine.sync(credentials);
      expect(await testDb.drawings.count()).toBe(2);
      expect(statusStore.getState().state).toBe('idle');
    });

    it('recovers cleanly after crash between durable commit and transport in-memory ack', async () => {
      const fileId = 'journal-crash-post-commit-pre-ack';
      const mutations = [createDrawingMutation(1), createDrawingMutation(2)];

      const fileMeta: DriveFileMetadata = {
        id: fileId,
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-engine' },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([fileMeta]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-engine',
        createdAt: isoTime,
        mutations,
      });

      const { transport, engine } = createEngine();

      // Simulate crash right after reconciler commits to Dexie but before/during transport ack
      let crashBeforeAck = true;
      const origAck = transport.acknowledgePull!.bind(transport);
      vi.spyOn(transport, 'acknowledgePull').mockImplementation(async (...args) => {
        if (crashBeforeAck) {
          crashBeforeAck = false;
          throw new Error('Simulated crash after Dexie commit before in-memory ack');
        }
        return origAck(...args);
      });

      await engine.sync(credentials);
      expect(statusStore.getState().state).toBe('error');

      // Verify that Dexie transaction committed successfully prior to crash
      expect(await testDb.drawings.count()).toBe(2);
      const midState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(midState?.appliedFileIds).toContain(fileId);
      expect(midState?.lastServerCursor).toBe(2);

      // Restarted engine starts up
      const { engine: restartedEngine } = createEngine();
      await restartedEngine.sync(credentials);

      // Restarted engine recognizes committed state in Dexie and does not duplicate writes
      expect(await testDb.drawings.count()).toBe(2);
      expect(statusStore.getState().state).toBe('idle');
      const finalState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(finalState?.appliedFileIds).toContain(fileId);
      expect(finalState?.lastServerCursor).toBe(2);
    });
  });

  describe('Scenario 9: Engine-Level UNACKED_COMPLETED_CANDIDATES & Rollback Retries', () => {
    it('redelivers uncommitted first journal on subsequent sync retry after transaction failure during reconcile', async () => {
      // Two journals: 100 + 60 mutations
      const files: DriveFileMetadata[] = [
        { id: 'engine-file-first', name: `journal_${hlcTime}.json.gz`, appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-engine' } },
        { id: 'engine-file-second', name: `journal_${hlcTime}.json.gz`, appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-engine' } },
      ];

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue(files);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockImplementation(async (fileId) => {
        const isFirst = fileId === 'engine-file-first';
        const count = isFirst ? 100 : 60;
        const baseIdx = isFirst ? 0 : 100;
        return {
          hlc: hlcTime,
          deviceId: 'peer-engine',
          createdAt: isoTime,
          mutations: Array.from({ length: count }, (_, i) => createDrawingMutation(baseIdx + i)),
        };
      });

      const { engine } = createEngine();

      // Hook Dexie transaction to fail during first sync's reconcile
      let failReconcile = true;
      testDb.syncState.hook('updating', function () {
        if (failReconcile) {
          throw new Error('Simulated Dexie failure during first journal reconcile');
        }
      });

      await engine.sync(credentials);
      expect(statusStore.getState().state).toBe('error');
      expect(await testDb.drawings.count()).toBe(0);

      // Clear the hook failure
      failReconcile = false;

      // Retry on the SAME engine instance
      await engine.sync(credentials);

      // Verify that all 160 drawings are persisted and cursor reached 160
      expect(statusStore.getState().state).toBe('idle');
      expect(await testDb.drawings.count()).toBe(160);
      const state = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(state?.lastServerCursor).toBe(160);
      expect(state?.appliedFileIds).toContain('engine-file-first');
      expect(state?.appliedFileIds).toContain('engine-file-second');
    });
  });

  describe('Scenario 10: Engine-Level UNSEEN_OLDER_JOURNAL Out-of-Order Reconciliation', () => {
    it('applies out-of-order older journal arriving in later sync run without skipping', async () => {
      const laterHlc = `${isoTime}_0001_peer-delayed-engine`;
      const olderHlc = `${isoTime}_0000_peer-delayed-engine`;

      const laterMeta: DriveFileMetadata = {
        id: 'engine-later-file',
        name: `journal_${laterHlc}.json.gz`,
        appProperties: { type: 'journal', hlc: laterHlc, deviceId: 'peer-delayed-engine' },
      };
      const olderMeta: DriveFileMetadata = {
        id: 'engine-older-file',
        name: `journal_${olderHlc}.json.gz`,
        appProperties: { type: 'journal', hlc: olderHlc, deviceId: 'peer-delayed-engine' },
      };

      // Start warm
      const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
      await stateRepo.saveSyncState({
        key: tokenKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 0,
        driveSeeded: true,
        pageToken: 'TOKEN_INIT',
        appliedFileIds: [],
        peerWatermarks: {},
      });

      let currentFeedFile: DriveFileMetadata = laterMeta;
      let currentNewToken = 'HEAD1';

      vi.mocked(mockDriveClient.listChanges).mockImplementation(async () => ({
        changes: [{ fileId: currentFeedFile.id, file: currentFeedFile }],
        newStartPageToken: currentNewToken,
      }));

      vi.mocked(mockDriveClient.downloadCompressedJson!).mockImplementation(async (fileId) => {
        if (fileId === 'engine-later-file') {
          return {
            hlc: laterHlc,
            deviceId: 'peer-delayed-engine',
            createdAt: isoTime,
            mutations: [createDrawingMutation(1)],
          };
        }
        return {
          hlc: olderHlc,
          deviceId: 'peer-delayed-engine',
          createdAt: isoTime,
          mutations: [createDrawingMutation(2)],
        };
      });

      const { engine } = createEngine();

      // Run 1: processes engine-later-file (HLC 0001)
      await engine.sync(credentials);
      expect(statusStore.getState().state).toBe('idle');
      expect(await testDb.drawings.count()).toBe(1);

      // Now feed serves engine-older-file (HLC 0000, lower than watermark 0001)
      currentFeedFile = olderMeta;
      currentNewToken = 'HEAD2';

      // Run 2: processes engine-older-file
      await engine.sync(credentials);
      expect(statusStore.getState().state).toBe('idle');

      // Both drawings must be applied!
      expect(await testDb.drawings.count()).toBe(2);
      const state = await stateRepo.getSyncState(tokenKey);
      expect(state?.pageToken).toBe('HEAD2');
    });
  });

  describe('Scenario 11: Engine-Level Staleness Fencing & Concurrency', () => {
    it('safely handles concurrent push while pull checkpoint advances without state clobbering', async () => {
      const { engine } = createEngine();

      // Enqueue a local mutation for push
      await queueRepo.enqueue({
        id: 'q-push-1',
        clientMutationId: 'mut-push-1',
        entityType: 'drawing',
        entityId: 'draw-pushed-1',
        operation: 'UPSERT',
        clientTimestamp: isoTime,
        status: 'pending',
        createdAt: isoTime,
        retryCount: 0,
        payload: {
          id: 'draw-pushed-1',
          documentId: 'doc-sync-1',
          color: '#333333',
          thickness: 1,
          points: [],
          createdAt: isoTime,
        },
      });

      // Prepare remote journal for pull
      const pullFile: DriveFileMetadata = {
        id: 'concurrent-pull-file',
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-engine' },
      };
      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([pullFile]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-engine',
        createdAt: isoTime,
        mutations: [createDrawingMutation(5)],
      });

      // Sync executes both push and pull in sequence
      await engine.sync(credentials);
      expect(statusStore.getState().state).toBe('idle');

      // Queue drained by push
      expect(await testDb.syncQueue.count()).toBe(0);

      // Pull drawing persisted
      expect(await testDb.drawings.count()).toBe(1);

      // State repository preserves pull checkpoint (appliedFileIds includes concurrent-pull-file)
      const finalState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(finalState?.appliedFileIds).toContain('concurrent-pull-file');
      expect(finalState?.lastServerCursor).toBe(1);
    });
  });

  describe('Scenario 12: Checkpoint Revision Preservation & Stale Receipt Fencing', () => {
    it('preserves checkpointRevision, pageToken, and cursor across engine cycle completion without full-row overwrite', async () => {
      const { engine } = createEngine();

      const pullFile: DriveFileMetadata = {
        id: 'rev-preservation-file',
        name: `journal_${hlcTime}.json.gz`,
        appProperties: { type: 'journal', hlc: hlcTime, deviceId: 'peer-engine' },
      };

      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([pullFile]);
      vi.mocked(mockDriveClient.downloadCompressedJson!).mockResolvedValue({
        hlc: hlcTime,
        deviceId: 'peer-engine',
        createdAt: isoTime,
        mutations: [createDrawingMutation(1)],
      });

      // Execute sync cycle
      await engine.sync(credentials);
      expect(statusStore.getState().state).toBe('idle');

      // Assert that checkpointRevision was committed and preserved
      const finalState = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(finalState?.checkpointRevision).toBeGreaterThanOrEqual(1);
      expect(finalState?.lastServerCursor).toBe(1);
      expect(finalState?.appliedFileIds).toContain('rev-preservation-file');
      expect(finalState?.lastSyncedAt).toBeDefined();

      const committedRevision = finalState!.checkpointRevision;

      // Subsequent interleaved metadata update via updateSyncState must preserve checkpointRevision
      await stateRepo.updateSyncState?.(`${credentials.userId}:${credentials.deviceId}`, (current) => ({
        ...current!,
        lastSyncedAt: new Date().toISOString(),
      }));

      const stateAfterUpdate = await stateRepo.getSyncState(`${credentials.userId}:${credentials.deviceId}`);
      expect(stateAfterUpdate?.checkpointRevision).toBe(committedRevision);
      expect(stateAfterUpdate?.lastServerCursor).toBe(1);
      expect(stateAfterUpdate?.appliedFileIds).toContain('rev-preservation-file');
    });

    it('terminates cleanly without acknowledging stale receipt or infinite looping when reconciler fences stale batch', async () => {
      const tokenKey = `${credentials.userId}:${credentials.deviceId}`;

      // Durable DB state is at revision 2, cursor 10
      await stateRepo.saveSyncState({
        key: tokenKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: 10,
        checkpointRevision: 2,
        driveSeeded: true,
        pageToken: 'TOKEN_CURRENT',
        appliedFileIds: ['file-1'],
      });

      const { transport, engine } = createEngine();

      // Mock transport.pull to return a stale batch with baseRevision: 1
      const staleBatch = {
        newCursor: 11,
        hasMore: false,
        changes: [
          {
            sequence: 11,
            entityType: 'drawing' as const,
            entityId: 'draw-stale-engine',
            operation: 'UPSERT' as const,
            changedAt: isoTime,
            data: {
              id: 'draw-stale-engine',
              documentId: 'doc-1',
              color: '#000000',
              thickness: 1,
              points: [],
              createdAt: isoTime,
            },
          },
        ],
        receipt: {
          receiptId: 'rcpt-stale-engine',
          userId: credentials.userId,
          deviceId: credentials.deviceId,
          baseCursor: 10,
          baseRevision: 1, // Stale! Durable DB has revision 2
          appliedFileIds: ['file-stale-engine'],
        },
      };

      vi.spyOn(transport, 'pull').mockResolvedValueOnce(staleBatch as any);
      const ackSpy = vi.spyOn(transport, 'acknowledgePull');

      // Execute sync
      await engine.sync(credentials);

      // Invariant: engine must NOT acknowledge the stale receipt
      expect(ackSpy).not.toHaveBeenCalledWith(credentials, staleBatch.receipt);

      // Invariant: drawing was NOT persisted
      expect(await testDb.drawings.get('draw-stale-engine')).toBeUndefined();

      // Invariant: engine state completes idle without crash
      expect(statusStore.getState().state).toBe('idle');
      expect(statusStore.getState().lastError).toBeUndefined();

      // Invariant: stored state is NOT regressed
      const state = await stateRepo.getSyncState(tokenKey);
      expect(state?.checkpointRevision).toBe(2);
      expect(state?.lastServerCursor).toBe(10);
      expect(state?.appliedFileIds).not.toContain('file-stale-engine');
    });

    it('does not regress cursor, checkpointRevision, or pageToken when reconciler commit is interleaved before final metadata update in executeCycle', async () => {
      const { engine } = createEngine();
      const tokenKey = `${credentials.userId}:${credentials.deviceId}`;

      // Drive client returns no changes so initial pull sees cursor 0
      vi.mocked(mockDriveClient.listFiles).mockResolvedValue([]);

      let callCount = 0;
      const originalCountPending = queueRepo.countPending.bind(queueRepo);
      vi.spyOn(queueRepo, 'countPending').mockImplementation(async () => {
        callCount++;
        // Interleave reconciler commit during the final countPending in Step 4
        if (callCount === 2) {
          const currentState = await stateRepo.getSyncState(tokenKey);
          const currentRev = currentState?.checkpointRevision ?? 0;
          await reconciler.reconcilePullBatch(credentials.userId, credentials.deviceId, 0, {
            newCursor: 1,
            hasMore: false,
            changes: [
              {
                sequence: 1,
                entityType: 'drawing',
                entityId: 'interleaved-draw-1',
                operation: 'UPSERT',
                changedAt: isoTime,
                data: {
                  id: 'interleaved-draw-1',
                  documentId: 'doc-1',
                  color: '#00ff00',
                  thickness: 2,
                  points: [],
                  createdAt: isoTime,
                },
              },
            ],
            receipt: {
              receiptId: 'interleaved-rcpt-1',
              userId: credentials.userId,
              deviceId: credentials.deviceId,
              baseCursor: 0,
              baseRevision: currentRev,
              pageToken: 'TOKEN_CONCURRENT_COMMITTED',
              appliedFileIds: ['interleaved-file-1'],
            },
          });
        }
        return originalCountPending();
      });

      // Execute sync cycle (which started with cursor 0)
      await engine.sync(credentials);

      expect(statusStore.getState().state).toBe('idle');

      // Assert that after executeCycle finishes:
      // 1. lastServerCursor in syncState is the newer cursor (1, not regressed to 0)
      const finalState = await stateRepo.getSyncState(tokenKey);
      expect(finalState?.lastServerCursor).toBe(1);

      // 2. this.statusStore.getState().lastServerCursor is also the newer cursor (1)
      expect(statusStore.getState().lastServerCursor).toBe(1);

      // 3. Checkpoint revision and newest page token are preserved
      expect(finalState?.checkpointRevision).toBe(2);
      expect(finalState?.pageToken).toBe('TOKEN_CONCURRENT_COMMITTED');
      expect(finalState?.appliedFileIds).toContain('interleaved-file-1');
    });
  });
});
