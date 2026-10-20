import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../database/schema/LunaClairDatabase';
import { HydrationManager } from '../HydrationManager';
import type { ClonePublishedShareUseCase } from '../../../application/use-cases/sharing/ClonePublishedShareUseCase';
import type { SyncPointerPayload } from '../../../domain/sync/models/SyncPointer';
import { ShareHttpError, ShareNetworkError } from '../../api/transports/WorkerShareTransport';

describe('HydrationManager', () => {
  let db: LunaClairDatabase;
  let mockCloneUseCase: ClonePublishedShareUseCase;
  let manager: HydrationManager;

  const samplePointer: SyncPointerPayload = {
    originShareId: 'share-quantum-101',
    title: 'Quantum Physics Fundamentals',
    publishedAt: '2026-10-15T12:00:00.000Z',
    schemaVersion: 1,
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    db = new LunaClairDatabase(`test-hydration-${Math.random().toString(36).slice(2)}`);
    await db.open();

    mockCloneUseCase = {
      execute: vi.fn(async () => ({
        share: {} as any,
        importResult: { materialIds: ['mat-1'], questionIds: [], quizIds: [] },
      })),
    } as unknown as ClonePublishedShareUseCase;

    manager = new HydrationManager({
      db,
      cloneUseCase: mockCloneUseCase,
      initialBackoffMs: 500,
      maxBackoffMs: 5000,
    });
  });

  afterEach(async () => {
    if (db && db.isOpen()) {
      await db.delete();
      db.close();
    }
  });

  it('enqueues a pointer operation into db.pendingHydrations', async () => {
    await manager.enqueuePointer(samplePointer);

    const row = await db.pendingHydrations.get(samplePointer.originShareId);
    expect(row).toBeDefined();
    expect(row?.originShareId).toBe(samplePointer.originShareId);
    expect(row?.title).toBe(samplePointer.title);
    expect(row?.publishedAt).toBe(samplePointer.publishedAt);
    expect(row?.schemaVersion).toBe(1);
    expect(row?.attempts).toBe(0);
    expect(row?.nextAttemptAt).toBe(0);
  });

  it('does not overwrite attempts or backoff if pointer is already pending', async () => {
    await db.pendingHydrations.put({
      originShareId: samplePointer.originShareId,
      attempts: 3,
      nextAttemptAt: Date.now() + 10000,
      title: samplePointer.title,
    });

    await manager.enqueuePointer(samplePointer);

    const row = await db.pendingHydrations.get(samplePointer.originShareId);
    expect(row?.attempts).toBe(3);
  });

  it('processes queue successfully, hydrates package, and deletes row from pendingHydrations', async () => {
    await manager.enqueuePointer(samplePointer);

    const result = await manager.processQueue();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.delisted).toBe(0);
    expect(result.failed).toBe(0);

    expect(mockCloneUseCase.execute).toHaveBeenCalledTimes(1);
    expect(mockCloneUseCase.execute).toHaveBeenCalledWith(
      { shareId: samplePointer.originShareId },
      undefined
    );

    const rowAfter = await db.pendingHydrations.get(samplePointer.originShareId);
    expect(rowAfter).toBeUndefined();
  });

  it('removes permanently unavailable 404/410 shares from queue and marks as delisted without retrying', async () => {
    vi.mocked(mockCloneUseCase.execute).mockRejectedValueOnce(
      new ShareHttpError(404, 'Share not found')
    );

    await manager.enqueuePointer(samplePointer);

    const result = await manager.processQueue();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.delisted).toBe(1);
    expect(result.failed).toBe(0);

    expect(manager.isDelisted(samplePointer.originShareId)).toBe(true);

    const rowAfter = await db.pendingHydrations.get(samplePointer.originShareId);
    expect(rowAfter).toBeUndefined();

    // Subsequent pointer enqueue for delisted share is ignored
    await manager.enqueuePointer(samplePointer);
    const rowAfterReEnqueue = await db.pendingHydrations.get(samplePointer.originShareId);
    expect(rowAfterReEnqueue).toBeUndefined();
  });

  it('handles 410 Gone as permanently unavailable', async () => {
    vi.mocked(mockCloneUseCase.execute).mockRejectedValueOnce(
      new ShareHttpError(410, 'Share has expired or been removed')
    );

    await manager.enqueuePointer(samplePointer);

    const result = await manager.processQueue();

    expect(result.delisted).toBe(1);
    expect(manager.isDelisted(samplePointer.originShareId)).toBe(true);

    const rowAfter = await db.pendingHydrations.get(samplePointer.originShareId);
    expect(rowAfter).toBeUndefined();
  });

  it('handles network error with exponential backoff without throwing or blocking', async () => {
    vi.mocked(mockCloneUseCase.execute).mockRejectedValueOnce(
      new ShareNetworkError('Network connectivity lost')
    );

    await manager.enqueuePointer(samplePointer);

    const beforeAttempt = Date.now();
    const result = await manager.processQueue();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.delisted).toBe(0);
    expect(result.failed).toBe(1);

    const rowAfter = await db.pendingHydrations.get(samplePointer.originShareId);
    expect(rowAfter).toBeDefined();
    expect(rowAfter?.attempts).toBe(1);
    expect(rowAfter?.nextAttemptAt).toBeGreaterThanOrEqual(beforeAttempt + 500);
    expect(rowAfter?.lastError).toContain('Network connectivity lost');

    // Immediate second processQueue skips entry because backoff time has not elapsed
    const result2 = await manager.processQueue();
    expect(result2.processed).toBe(0);
  });

  it('aborts processing when signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await manager.enqueuePointer(samplePointer);

    const result = await manager.processQueue(controller.signal);
    expect(result.processed).toBe(0);
    expect(mockCloneUseCase.execute).not.toHaveBeenCalled();
  });

  it('notifies and runs processQueue in background', async () => {
    await manager.enqueuePointer(samplePointer);

    manager.notify();

    // Allow microtasks and promise resolution
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockCloneUseCase.execute).toHaveBeenCalledTimes(1);
    const rowAfter = await db.pendingHydrations.get(samplePointer.originShareId);
    expect(rowAfter).toBeUndefined();
  });

  it('does not enqueue pointer if material with originShareId already exists in db.materials', async () => {
    await db.materials.put({
      id: `mat_share_${samplePointer.originShareId}`,
      documentId: `doc_share_${samplePointer.originShareId}`,
      title: samplePointer.title,
      order: 0,
      createdAt: '2026-10-15T12:00:00.000Z',
      updatedAt: '2026-10-15T12:00:00.000Z',
      originShareId: samplePointer.originShareId,
    });

    await manager.enqueuePointer(samplePointer);

    const row = await db.pendingHydrations.get(samplePointer.originShareId);
    expect(row).toBeUndefined();
  });

  it('skips download and deletes pending entry in processQueue if material already exists in db.materials', async () => {
    // Put pending item in queue first
    await db.pendingHydrations.put({
      originShareId: samplePointer.originShareId,
      attempts: 0,
      nextAttemptAt: 0,
      title: samplePointer.title,
    });

    // Material exists in library (e.g. cloned concurrently or via non-deterministic ID)
    await db.materials.put({
      id: 'custom-mat-456',
      documentId: 'custom-doc-456',
      title: samplePointer.title,
      order: 0,
      createdAt: '2026-10-15T12:00:00.000Z',
      updatedAt: '2026-10-15T12:00:00.000Z',
      originShareId: samplePointer.originShareId,
    });

    const result = await manager.processQueue();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockCloneUseCase.execute).not.toHaveBeenCalled();

    const rowAfter = await db.pendingHydrations.get(samplePointer.originShareId);
    expect(rowAfter).toBeUndefined();
  });

  it('drops from pendingHydrations queue when retry attempts reach maxAttempts', async () => {
    const retryManager = new HydrationManager({
      db,
      cloneUseCase: mockCloneUseCase,
      initialBackoffMs: 10,
      maxBackoffMs: 100,
      maxAttempts: 3,
    });

    vi.mocked(mockCloneUseCase.execute).mockRejectedValue(
      new ShareNetworkError('Continuous gateway timeout')
    );

    await retryManager.enqueuePointer(samplePointer);

    // Attempt 1 (0 -> 1)
    const result1 = await retryManager.processQueue();
    expect(result1.processed).toBe(1);
    expect(result1.failed).toBe(1);
    let row = await db.pendingHydrations.get(samplePointer.originShareId);
    expect(row?.attempts).toBe(1);

    // Reset nextAttemptAt to simulate elapsed backoff
    await db.pendingHydrations.update(samplePointer.originShareId, { nextAttemptAt: 0 });

    // Attempt 2 (1 -> 2)
    const result2 = await retryManager.processQueue();
    expect(result2.processed).toBe(1);
    expect(result2.failed).toBe(1);
    row = await db.pendingHydrations.get(samplePointer.originShareId);
    expect(row?.attempts).toBe(2);

    // Reset nextAttemptAt to simulate elapsed backoff
    await db.pendingHydrations.update(samplePointer.originShareId, { nextAttemptAt: 0 });

    // Attempt 3 (2 -> 3 >= maxAttempts 3: drops from queue)
    const result3 = await retryManager.processQueue();
    expect(result3.processed).toBe(1);
    expect(result3.failed).toBe(1);

    const rowFinal = await db.pendingHydrations.get(samplePointer.originShareId);
    expect(rowFinal).toBeUndefined();
  });
});
