import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { DexieStudyPackageImportService } from '../../../../infrastructure/database/services/DexieStudyPackageImportService';
import { DexieLibraryImportService } from '../../../../infrastructure/database/services/DexieLibraryImportService';
import { ImportStudyPackageUseCase } from '../../package/ImportStudyPackageUseCase';
import { ClonePublishedShareUseCase } from '../ClonePublishedShareUseCase';
import { FetchPublishedShareUseCase } from '../FetchPublishedShareUseCase';
import { TrackShareDownloadUseCase } from '../TrackShareDownloadUseCase';
import { RemoveMaterialUseCase } from '../../library/RemoveMaterialUseCase';
import { FLOOR_ISO } from '../../../../domain/sync/utils/hlc';
import { cardKeyForQuestion, cardKeyForBlank } from '../../../../domain/flashcards/engines/cardKey';
import { questionToCards } from '../../../../domain/flashcards/engines/questionToCards';
import { collectVaultChunksGzipped } from '../../../../infrastructure/api/google/streamVaultChunksGzipped';
import { GoogleDriveSyncTransport } from '../../../../infrastructure/api/transports/GoogleDriveSyncTransport';
import type { PublishedShare, ShareTransport } from '../../../../domain/sharing/models/sharing.types';
import type { StudyPackage } from '../../../../domain/package/models/package.types';
import type { SyncMutation } from '../../../../domain/sync/models/sync.types';
import type { GoogleDrivePort } from '../../../../domain/drive/models/drive.types';
import type { GoogleAuthPort } from '../../../../domain/auth/models/auth.types';

describe('ExploreCloneMultiDeviceSync Integration Test Suite', () => {
  let dbA: LunaClairDatabase;
  let dbB: LunaClairDatabase;

  const originShareId = 'share_physics_quantum_101';
  const samplePackage: StudyPackage = {
    format: 'lcpack',
    schemaVersion: 1,
    metadata: {
      title: 'Quantum Physics Fundamentals',
      createdAt: '2026-10-15T00:00:00.000Z',
    },
    materials: [
      {
        id: 'pkg_mat_quantum_notes',
        title: 'Quantum Physics Fundamentals',
        documentContent: '# Quantum Physics\nWave-particle duality and uncertainty.',
        tags: ['physics', 'quantum'],
      },
    ],
    questions: [
      {
        id: 'pkg_q_true_false_photon',
        materialId: 'pkg_mat_quantum_notes',
        type: 'true_false',
        prompt: 'Photons exhibit both wave and particle characteristics.',
        payload: { type: 'true_false', correctAnswer: true },
        points: 5,
        difficulty: 'easy',
      },
      {
        id: 'pkg_q_cloze_heisenberg',
        materialId: 'pkg_mat_quantum_notes',
        type: 'fill_in_blank',
        prompt: 'Heisenberg proposed the uncertainty principle.',
        payload: {
          type: 'fill_in_blank',
          template: 'Heisenberg formulated the ___ principle.',
          blanks: ['uncertainty'],
        },
        points: 10,
        difficulty: 'medium',
      },
    ],
    quizzes: [
      {
        id: 'pkg_quiz_quantum_exam',
        materialId: 'pkg_mat_quantum_notes',
        title: 'Quantum Midterm Exam',
        items: [
          {
            questionId: 'pkg_q_true_false_photon',
            order: 0,
          },
          {
            questionId: 'pkg_q_cloze_heisenberg',
            order: 1,
          },
        ],
      },
    ],
    assets: [],
  };

  const samplePublishedShare: PublishedShare = {
    id: originShareId,
    format: 'lcpack',
    schemaVersion: 1,
    title: 'Quantum Physics Fundamentals',
    accessType: 'public',
    package: samplePackage,
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
    viewCount: 42,
    downloadCount: 7,
  };

  let mockShareTransport: ShareTransport;
  let mockDriveClient: GoogleDrivePort;
  let mockAuthService: GoogleAuthPort;

  beforeEach(async () => {
    vi.restoreAllMocks();

    dbA = new LunaClairDatabase(`test-device-a-${Math.random().toString(36).slice(2)}`);
    dbB = new LunaClairDatabase(`test-device-b-${Math.random().toString(36).slice(2)}`);
    await dbA.open();
    await dbB.open();

    mockShareTransport = {
      fetch: vi.fn(async (id: string) => {
        if (id === originShareId) return samplePublishedShare;
        throw new Error(`Share not found: ${id}`);
      }),
      trackDownload: vi.fn(async () => ({ success: true, downloadCount: 8 })),
      publish: vi.fn(),
      delete: vi.fn(),
      listPublicShares: vi.fn(),
    };

    mockDriveClient = {
      generateFileId: vi.fn(async () => 'gen-id-test'),
      uploadFile: vi.fn(async (params) => ({
        id: params.fileId ?? 'uploaded-file-test',
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
        id: 'uploaded-journal-test',
        name,
        appProperties,
      })),
      downloadCompressedJson: vi.fn(async () => ({
        hlc: '2026-10-15T12:00:00.000Z_0000_peer',
        deviceId: 'peer',
        createdAt: '2026-10-15T12:00:00.000Z',
        mutations: [],
      })) as unknown as GoogleDrivePort['downloadCompressedJson'],
      recoverFromInvalidPageToken: vi.fn(async () => ({
        newPageToken: 'recovered-start-token',
        missingFiles: [],
      })),
    };

    mockAuthService = {
      login: vi.fn(),
      logout: vi.fn(),
      getValidAccessToken: vi.fn(async () => 'mock-token'),
      getSession: vi.fn(() => null),
      getStatus: vi.fn(() => 'authenticated' as const),
      subscribe: vi.fn(() => () => {}),
    };
  });

  afterEach(async () => {
    if (dbA && dbA.isOpen()) {
      await dbA.delete();
      dbA.close();
    }
    if (dbB && dbB.isOpen()) {
      await dbB.delete();
      dbB.close();
    }
  });

  function createDeviceStack(db: LunaClairDatabase) {
    const fetchUseCase = new FetchPublishedShareUseCase(mockShareTransport);
    const trackUseCase = new TrackShareDownloadUseCase(mockShareTransport);
    const importService = new DexieStudyPackageImportService(db);
    const importUseCase = new ImportStudyPackageUseCase(importService);
    const cloneUseCase = new ClonePublishedShareUseCase(fetchUseCase, importUseCase, trackUseCase);

    const libraryImportService = new DexieLibraryImportService(db);
    const removeUseCase = new RemoveMaterialUseCase(libraryImportService);

    return {
      cloneUseCase,
      removeUseCase,
      importService,
      libraryImportService,
    };
  }

  it('Invariant 1 (Deterministic ID Convergence): Two independent clone operations with the same originShareId produce identical materialId, documentId, questionId, and flashcard review keys', async () => {
    const stackA = createDeviceStack(dbA);
    const stackB = createDeviceStack(dbB);

    // Device A clones the published share
    const resultA = await stackA.cloneUseCase.execute({ shareId: originShareId });
    // Device B independently clones the same published share
    const resultB = await stackB.cloneUseCase.execute({ shareId: originShareId });

    // 1. Material ID exact convergence
    expect(resultA.importResult.materialIds).toHaveLength(1);
    expect(resultB.importResult.materialIds).toHaveLength(1);
    const expectedMaterialId = `mat_share_${originShareId}`;
    expect(resultA.importResult.materialIds[0]).toBe(expectedMaterialId);
    expect(resultB.importResult.materialIds[0]).toBe(expectedMaterialId);

    const matA = await dbA.materials.get(expectedMaterialId);
    const matB = await dbB.materials.get(expectedMaterialId);
    expect(matA).toBeDefined();
    expect(matB).toBeDefined();
    expect(matA?.id).toBe(matB?.id);

    // 2. Document ID exact convergence
    const expectedDocumentId = `doc_share_${originShareId}`;
    expect(matA?.documentId).toBe(expectedDocumentId);
    expect(matB?.documentId).toBe(expectedDocumentId);

    const docA = await dbA.documentContents.get(expectedDocumentId);
    const docB = await dbB.documentContents.get(expectedDocumentId);
    expect(docA).toBeDefined();
    expect(docB).toBeDefined();
    expect(docA?.documentId).toBe(docB?.documentId);
    expect(docA?.content).toBe(docB?.content);

    // 3. Question IDs exact convergence
    expect(resultA.importResult.questionIds).toHaveLength(2);
    expect(resultB.importResult.questionIds).toHaveLength(2);
    expect(resultA.importResult.questionIds).toEqual(resultB.importResult.questionIds);

    const expectedQ1Id = `q_share_${originShareId}_pkg_q_true_false_photon`;
    const expectedQ2Id = `q_share_${originShareId}_pkg_q_cloze_heisenberg`;
    expect(resultA.importResult.questionIds).toContain(expectedQ1Id);
    expect(resultA.importResult.questionIds).toContain(expectedQ2Id);

    const q1A = await dbA.questions.get(expectedQ1Id);
    const q1B = await dbB.questions.get(expectedQ1Id);
    expect(q1A).toBeDefined();
    expect(q1B).toBeDefined();
    expect(q1A?.id).toBe(q1B?.id);

    const q2A = await dbA.questions.get(expectedQ2Id);
    const q2B = await dbB.questions.get(expectedQ2Id);
    expect(q2A).toBeDefined();
    expect(q2B).toBeDefined();
    expect(q2A?.id).toBe(q2B?.id);

    // 4. Flashcard Review Keys convergence
    // Whole-question card key format: q:${questionId}
    const reviewKeyQ1A = cardKeyForQuestion(q1A!.id);
    const reviewKeyQ1B = cardKeyForQuestion(q1B!.id);
    expect(reviewKeyQ1A).toBe(`q:${expectedQ1Id}`);
    expect(reviewKeyQ1A).toBe(reviewKeyQ1B);

    // Per-blank card key format for cloze: q:${questionId}#${blankIndex}
    const reviewKeyQ2Blank0A = cardKeyForBlank(q2A!.id, 0);
    const reviewKeyQ2Blank0B = cardKeyForBlank(q2B!.id, 0);
    expect(reviewKeyQ2Blank0A).toBe(`q:${expectedQ2Id}#0`);
    expect(reviewKeyQ2Blank0A).toBe(reviewKeyQ2Blank0B);

    // End-to-end card projection verification: questionToCards yields identical keys across devices
    const cardsQ1A = questionToCards(q1A!);
    const cardsQ1B = questionToCards(q1B!);
    expect(cardsQ1A.map((c) => c.key)).toEqual(cardsQ1B.map((c) => c.key));
    expect(cardsQ1A[0]?.key).toBe(`q:${expectedQ1Id}`);

    const cardsQ2A = questionToCards(q2A!);
    const cardsQ2B = questionToCards(q2B!);
    expect(cardsQ2A.map((c) => c.key)).toEqual(cardsQ2B.map((c) => c.key));
    expect(cardsQ2A[0]?.key).toBe(`q:${expectedQ2Id}#0`);
  });

  it('Invariant 2 (Epoch Floor & Zero-Journal Baseline): Fresh clone has documentContents.updatedAt === FLOOR_ISO; streamVaultChunksGzipped and collectLocalDeltas skip this document', async () => {
    const stackA = createDeviceStack(dbA);
    const testDeviceId = 'device-A-id';

    // Fresh cold clone on Device A
    await stackA.cloneUseCase.execute({ shareId: originShareId });

    const expectedDocumentId = `doc_share_${originShareId}`;
    const doc = await dbA.documentContents.get(expectedDocumentId);
    expect(doc).toBeDefined();

    // 1. Pinned to canonical epoch floor
    expect(doc?.updatedAt).toBe(FLOOR_ISO);
    expect(doc?.deletedAt).toBeNull();

    // 2. Zero entries written to syncQueue outbox journal
    const outboxEntries = await dbA.syncQueue.toArray();
    expect(outboxEntries).toHaveLength(0);

    // 3. streamVaultChunksGzipped skips this document during baseline snapshot seeding
    const baselineChunks = await collectVaultChunksGzipped(dbA, testDeviceId);
    const baselineDocMutations = baselineChunks
      .flatMap((chunk) => chunk.mutations)
      .filter((mutation) => mutation.entityId === expectedDocumentId);
    expect(baselineDocMutations).toHaveLength(0);

    // 4. collectLocalDeltas skips this document during warm remote sync delta collection
    const transportA = new GoogleDriveSyncTransport({
      driveClient: mockDriveClient,
      authService: mockAuthService,
      db: dbA,
    });
    const localDeltas: SyncMutation[] = [];
    // Invoke private collectLocalDeltas via any-cast to verify delta scanner
    await (transportA as any).collectLocalDeltas(new Map(), localDeltas, testDeviceId);
    const deltaDocMutations = localDeltas.filter(
      (mutation) => mutation.entityId === expectedDocumentId
    );
    expect(deltaDocMutations).toHaveLength(0);
  });

  it('Invariant 3 (Hydration Preservation / LWW Inversion Prevention): Preserves user-modified document content on re-clone when updatedAt > FLOOR_ISO', async () => {
    const stackB = createDeviceStack(dbB);
    const expectedDocumentId = `doc_share_${originShareId}`;

    // 1. Initial clone on Device B
    await stackB.cloneUseCase.execute({ shareId: originShareId });

    // 2. Simulate Device B having local user edits (updatedAt > FLOOR_ISO)
    const userEditTimestamp = '2026-10-16T14:30:00.000Z';
    const customizedContent = '# My Custom Quantum Notes\nI added personal derivation steps.';
    await dbB.documentContents.update(expectedDocumentId, {
      content: customizedContent,
      updatedAt: userEditTimestamp,
      version: 2,
    });

    const docBeforeReclone = await dbB.documentContents.get(expectedDocumentId);
    expect(docBeforeReclone?.content).toBe(customizedContent);
    expect(docBeforeReclone?.updatedAt).toBe(userEditTimestamp);

    // 3. User clicks "Clone to Library" again for that originShareId on Device B
    await stackB.cloneUseCase.execute({ shareId: originShareId });

    // 4. Verification: user markdown content, version, and updatedAt are strictly preserved!
    const docAfterReclone = await dbB.documentContents.get(expectedDocumentId);
    expect(docAfterReclone).toBeDefined();
    expect(docAfterReclone?.content).toBe(customizedContent);
    expect(docAfterReclone?.updatedAt).toBe(userEditTimestamp);
    expect(docAfterReclone?.version).toBe(2);

    // Zero outbox mutations emitted for preserved hydration
    const outbox = await dbB.syncQueue.toArray();
    expect(outbox).toHaveLength(0);
  });

  it('Invariant 4 (Tombstone Resurrection): Deleting course tombstones documentContents; re-cloning revives document, enqueues UPSERT to syncQueue, and sweeps stale annotations', async () => {
    const stackB = createDeviceStack(dbB);
    const expectedMaterialId = `mat_share_${originShareId}`;
    const expectedDocumentId = `doc_share_${originShareId}`;

    // 1. Clone course on Device B
    await stackB.cloneUseCase.execute({ shareId: originShareId });

    // Add active annotations attached to this course
    await dbB.highlights.add({
      id: 'hl-active-1',
      documentId: expectedDocumentId,
      start: 0,
      end: 14,
      color: 'yellow',
      text: 'Quantum Physics',
      createdAt: '2026-10-16T08:00:00.000Z',
    });
    await dbB.drawings.add({
      id: 'dr-active-1',
      documentId: expectedDocumentId,
      color: '#00ff00',
      thickness: 3,
      points: [{ x: 0.2, y: 0.3 }],
      createdAt: '2026-10-16T08:00:00.000Z',
    });

    // 2. Simulate course deletion via RemoveMaterialUseCase
    const tombstoneTimestampBefore = new Date().toISOString();
    await stackB.removeUseCase.execute(expectedMaterialId);
    const tombstoneTimestampAfter = new Date().toISOString();

    // Verification of tombstone state:
    // Local material row is removed
    const matAfterDelete = await dbB.materials.get(expectedMaterialId);
    expect(matAfterDelete).toBeUndefined();

    // Document is tombstoned
    const tombstonedDoc = await dbB.documentContents.get(expectedDocumentId);
    expect(tombstonedDoc).toBeDefined();
    expect(tombstonedDoc?.deletedAt).toBeTruthy();
    expect(tombstonedDoc!.deletedAt! >= tombstoneTimestampBefore).toBe(true);
    expect(tombstonedDoc!.deletedAt! <= tombstoneTimestampAfter).toBe(true);
    expect(tombstonedDoc?.version).toBe(1);

    // Active highlights were tombstoned during deletion cascade
    const tombstonedHl = await dbB.highlights.get('hl-active-1');
    expect(tombstonedHl?.deletedAt).toBeTruthy();

    // 3. Simulate a lingering un-tombstoned annotation remnant
    await dbB.highlights.add({
      id: 'hl-lingering-stale',
      documentId: expectedDocumentId,
      start: 20,
      end: 35,
      color: 'pink',
      text: 'Wave-particle',
      createdAt: '2026-10-16T07:00:00.000Z',
      // un-tombstoned (deletedAt undefined)
    });

    // Clear previous deletion outbox mutations to isolate resurrection mutation assertion
    await dbB.syncQueue.clear();

    // 4. Re-clone that share on Device B (Tombstone Resurrection)
    const resurrectionBefore = new Date().toISOString();
    await stackB.cloneUseCase.execute({ shareId: originShareId });
    const resurrectionAfter = new Date().toISOString();

    // Verification of resurrection state:
    // (a) Material row is restored
    const restoredMat = await dbB.materials.get(expectedMaterialId);
    expect(restoredMat).toBeDefined();
    expect(restoredMat?.id).toBe(expectedMaterialId);
    expect(restoredMat?.title).toBe('Quantum Physics Fundamentals');

    // (b) Document is resurrected with deletedAt: null and fresh updatedAt
    const resurrectedDoc = await dbB.documentContents.get(expectedDocumentId);
    expect(resurrectedDoc).toBeDefined();
    expect(resurrectedDoc?.deletedAt).toBeNull();
    expect(resurrectedDoc!.updatedAt >= resurrectionBefore).toBe(true);
    expect(resurrectedDoc!.updatedAt <= resurrectionAfter).toBe(true);
    expect(resurrectedDoc?.version).toBe(2);
    expect(resurrectedDoc?.content).toBe(samplePackage.materials[0]!.documentContent);

    // (c) Sync outbox mutation is enqueued for multi-device un-deletion propagation
    const outbox = await dbB.syncQueue.toArray();
    expect(outbox).toHaveLength(1);
    const mutation = outbox[0]!;
    expect(mutation.entityType).toBe('document');
    expect(mutation.entityId).toBe(expectedDocumentId);
    expect(mutation.operation).toBe('UPSERT');
    expect(mutation.baseVersion).toBe(1);
    expect(mutation.status).toBe('pending');
    expect(mutation.payload).toEqual({
      documentId: expectedDocumentId,
      title: 'Quantum Physics Fundamentals',
      content: samplePackage.materials[0]!.documentContent,
      updatedAt: resurrectedDoc?.updatedAt,
      version: 2,
    });

    // (d) Stale lingering un-tombstoned annotations are swept
    const sweptHl = await dbB.highlights.get('hl-lingering-stale');
    expect(sweptHl).toBeDefined();
    expect(sweptHl?.deletedAt).toBe(resurrectedDoc?.updatedAt);
    expect(sweptHl?.updatedAt).toBe(resurrectedDoc?.updatedAt);
  });
});
