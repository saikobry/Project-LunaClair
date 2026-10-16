import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../schema/LunaClairDatabase';
import { DexieLibraryImportService } from '../DexieLibraryImportService';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';
import type { ImportedDocumentContent } from '../../../../domain/reader/repositories/DocumentContentRepository';

describe('DexieLibraryImportService', () => {
  let db: LunaClairDatabase;
  let service: DexieLibraryImportService;

  beforeEach(async () => {
    db = new LunaClairDatabase(`test-library-import-${Math.random().toString(36).slice(2)}`);
    await db.open();
    service = new DexieLibraryImportService(db);
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  /**
   * Seeds the rows a material owns, straight into the stores. The service is
   * removal-only, so the fixture is written by the database rather than through
   * it: what these tests assert is what `removeMaterial` clears, and each
   * dependency is named explicitly rather than bundled by a helper the service
   * used to provide.
   */
  async function seedMaterial(id = 'mat-1') {
    const now = '2026-08-01T00:00:00.000Z';
    const material: StudyMaterial = {
      id,
      title: `Material ${id}`,
      documentId: `doc-${id}`,
      order: 0,
      createdAt: now,
      updatedAt: now,
    };
    const question: Question = {
      id: `q-${id}`,
      materialId: id,
      type: 'true_false',
      prompt: 'Is biology science?',
      payload: { type: 'true_false', correctAnswer: true },
      difficulty: 'easy',
      points: 5,
      status: 'published',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const quiz: Quiz = {
      id: `quiz-${id}`,
      materialId: id,
      title: 'Quiz 1',
      items: [{ quizId: `quiz-${id}`, questionId: `q-${id}`, questionVersion: 1, order: 0 }],
      questionIds: [`q-${id}`],
      status: 'published',
      createdAt: now,
      updatedAt: now,
    };
    const documentContent: ImportedDocumentContent = {
      documentId: `doc-${id}`,
      title: `Material ${id}`,
      content: '# Biology Notes',
      updatedAt: now,
    };

    await db.materials.put(material);
    await db.questions.put(question);
    await db.quizzes.put(quiz);
    await db.documentContents.put(documentContent);
  }

  function reviewState(key: string, materialId: string) {
    return {
      key,
      materialId,
      repetitions: 2,
      easeFactor: 2.5,
      intervalDays: 6,
      dueAt: '2026-08-30T00:00:00.000Z',
      lapses: 0,
      lastReviewedAt: '2026-08-29T09:00:00.000Z',
      reviewCount: 2,
    };
  }

  it('removes the material, its questions, quizzes, and tombstones document content with sync outbox', async () => {
    await seedMaterial('mat-del');

    await service.removeMaterial('mat-del');

    // Material and associated learning content removed
    expect(await db.materials.get('mat-del')).toBeUndefined();
    expect(await db.questions.get('q-mat-del')).toBeUndefined();
    expect(await db.quizzes.get('quiz-mat-del')).toBeUndefined();

    // Document content is tombstoned (soft-deleted with deletedAt) for multi-device sync
    const doc = await db.documentContents.get('doc-mat-del');
    expect(doc).toBeDefined();
    expect(doc?.deletedAt).toBeDefined();
    expect(doc?.updatedAt).toBe(doc?.deletedAt);

    // Document DELETE mutation is enqueued in syncQueue
    const docOutbox = (await db.syncQueue.toArray()).filter((q) => q.entityId === 'doc-mat-del');
    expect(docOutbox).toHaveLength(1);
    expect(docOutbox[0].entityType).toBe('document');
    expect(docOutbox[0].operation).toBe('DELETE');
    expect(docOutbox[0].clientTimestamp).toBe(doc?.deletedAt);
  });

  it('tombstones active highlights and drawings and enqueues DELETE mutations in syncQueue, preserving already-deleted annotations', async () => {
    await seedMaterial('mat-annotations');
    const docId = 'doc-mat-annotations';

    // Seed highlights: one active, one already deleted, one on another document
    await db.highlights.bulkPut([
      {
        id: 'hl-active-1',
        documentId: docId,
        start: 0,
        end: 10,
        color: 'yellow',
        text: 'Active highlight',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'hl-already-deleted',
        documentId: docId,
        start: 15,
        end: 25,
        color: 'pink',
        text: 'Old highlight',
        createdAt: '2026-08-01T00:00:00.000Z',
        deletedAt: '2026-08-02T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
      },
      {
        id: 'hl-other-doc',
        documentId: 'doc-other',
        start: 0,
        end: 5,
        color: 'green',
        text: 'Other doc highlight',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ]);

    // Seed drawings: one active, one already deleted
    await db.drawings.bulkPut([
      {
        id: 'dr-active-1',
        documentId: docId,
        color: '#000',
        thickness: 2,
        points: [{ x: 10, y: 10 }],
        createdAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'dr-already-deleted',
        documentId: docId,
        color: '#111',
        thickness: 3,
        points: [{ x: 20, y: 20 }],
        createdAt: '2026-08-01T00:00:00.000Z',
        deletedAt: '2026-08-02T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
      },
    ]);

    await db.syncQueue.clear();

    await service.removeMaterial('mat-annotations');

    // Active highlight is tombstoned
    const hlActive = await db.highlights.get('hl-active-1');
    expect(hlActive?.deletedAt).toBeDefined();
    expect(hlActive?.updatedAt).toBe(hlActive?.deletedAt);

    // Already deleted highlight retains original deletedAt
    const hlOld = await db.highlights.get('hl-already-deleted');
    expect(hlOld?.deletedAt).toBe('2026-08-02T00:00:00.000Z');

    // Other doc highlight untouched
    const hlOther = await db.highlights.get('hl-other-doc');
    expect(hlOther?.deletedAt).toBeUndefined();

    // Active drawing is tombstoned
    const drActive = await db.drawings.get('dr-active-1');
    expect(drActive?.deletedAt).toBeDefined();
    expect(drActive?.updatedAt).toBe(drActive?.deletedAt);

    // Already deleted drawing retains original deletedAt
    const drOld = await db.drawings.get('dr-already-deleted');
    expect(drOld?.deletedAt).toBe('2026-08-02T00:00:00.000Z');

    // Outbox check
    const outboxItems = await db.syncQueue.toArray();
    const entityIds = outboxItems.map((item) => `${item.entityType}:${item.entityId}`).toSorted();

    expect(entityIds).toEqual([
      `document:${docId}`,
      'drawing:dr-active-1',
      'highlight:hl-active-1',
    ]);
    expect(outboxItems.every((item) => item.operation === 'DELETE')).toBe(true);
  });

  it('rolls back asset removal when the removal transaction fails', async () => {
    await seedMaterial('mat-rollback');
    await seedAssets('mat-rollback', 1);
    await db.collections.put({
      id: 'col-rollback',
      title: 'Rollback',
      order: 0,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    await db.collectionMaterials.add({
      collectionId: 'col-rollback',
      materialId: 'mat-rollback',
      order: 0,
      addedAt: '2026-08-01T00:00:00.000Z',
    });

    // Fail the asset delete, which runs last inside the transaction.
    vi.spyOn(db.localAssets, 'where').mockImplementationOnce(() => {
      throw new Error('Simulated asset delete failure');
    });

    await expect(service.removeMaterial('mat-rollback')).rejects.toThrow(
      'Simulated asset delete failure',
    );

    // Nothing was removed: the whole removal is one atomic unit — including the collection
    // membership cleared earlier in the same transaction, which the failure must roll back too.
    expect(await db.materials.get('mat-rollback')).toBeDefined();
    expect(await db.questions.get('q-mat-rollback')).toBeDefined();
    expect(await db.localAssets.where('materialId').equals('mat-rollback').toArray()).toHaveLength(2);
    expect(await db.collectionMaterials.where('materialId').equals('mat-rollback').toArray()).toHaveLength(1);
  });

  /**
   * Binary assets of the material — the importer's single original file (`assetId = materialId`)
   * plus any package-imported figures. Removal must not strand them in IndexedDB, and it must not
   * touch another material's assets.
   */
  async function seedAssets(materialId: string, figureCount: number) {
    await db.localAssets.put({
      assetId: materialId,
      materialId,
      blob: new Blob(['PDF BYTES'], { type: 'application/pdf' }),
      mimeType: 'application/pdf',
      filename: 'lecture.pdf',
      importedAt: '2026-08-01T00:00:00.000Z',
    });
    for (let i = 0; i < figureCount; i += 1) {
      await db.localAssets.put({
        assetId: `asset-figure-${materialId}-${i}`,
        materialId,
        blob: new Blob([`PNG BYTES ${i}`], { type: 'image/png' }),
        mimeType: 'image/png',
        filename: `figure-${i}.png`,
        importedAt: '2026-08-01T00:00:00.000Z',
      });
    }
  }

  it('removes every stored binary asset of the material, including N package figures', async () => {
    await seedMaterial('mat-owned');
    await seedMaterial('mat-other');
    await seedAssets('mat-owned', 3);
    await seedAssets('mat-other', 2);

    await service.removeMaterial('mat-owned');

    // The removed material owns no orphaned blobs...
    expect(await db.localAssets.where('materialId').equals('mat-owned').toArray()).toHaveLength(0);
    // ...and the untouched material keeps every one of its own.
    expect(await db.localAssets.where('materialId').equals('mat-other').toArray()).toHaveLength(3);
  });

  /**
   * Collection membership is part of the material's cascade. A stale `collectionMaterials` row would
   * keep the material counted as assigned (inflating the collection's count and hiding it from the
   * Library's `uncollected` lens) while the material itself no longer exists.
   */
  it('removes the material from every collection it was filed into', async () => {
    await seedMaterial('mat-filed');
    await seedMaterial('mat-unfiled');

    await db.collections.put({
      id: 'col-1',
      title: 'Biology',
      order: 0,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    await db.collectionMaterials.bulkAdd([
      { collectionId: 'col-1', materialId: 'mat-filed', order: 0, addedAt: '2026-08-01T00:00:00.000Z' },
      { collectionId: 'col-1', materialId: 'mat-unfiled', order: 1, addedAt: '2026-08-01T00:00:00.000Z' },
    ]);

    await service.removeMaterial('mat-filed');

    // The removed material's membership is gone...
    expect(await db.collectionMaterials.where('materialId').equals('mat-filed').toArray()).toHaveLength(0);
    // ...the collection itself survives, and the other material stays filed.
    expect(await db.collections.get('col-1')).toBeDefined();
    expect(await db.collectionMaterials.where('materialId').equals('mat-unfiled').toArray()).toHaveLength(1);
  });

  /**
   * A material's questions are deleted with it, and a question's cards are the
   * only thing that projects its review keys — so the schedules go too, and they
   * are tombstoned in the SAME transaction. The keys come from the `materialId`
   * index, which reaches every key of every question in the material: whole
   * question `q:<id>` keys and per-blank `q:<id>#<n>` keys alike.
   */
  it('removes and tombstones every flashcard schedule of the material, including per-blank keys', async () => {
    await seedMaterial('mat-studied');
    await seedMaterial('mat-untouched');
    await db.flashcardReviews.bulkPut([
      reviewState('q:q-mat-studied', 'mat-studied'),
      reviewState('q:q-mat-studied#0', 'mat-studied'),
      reviewState('q:q-mat-studied#1', 'mat-studied'),
      reviewState('q:q-mat-untouched', 'mat-untouched'),
    ]);
    await db.syncQueue.clear();

    await service.removeMaterial('mat-studied');

    expect(await db.flashcardReviews.toArray()).toHaveLength(1);
    expect((await db.flashcardReviews.toArray()).map((r) => r.key)).toEqual(['q:q-mat-untouched']);

    const tombstones = await db.syncQueue.toArray();
    const flashcardTombstones = tombstones.filter((item) => item.entityType === 'flashcardReview');
    expect(flashcardTombstones.map((item) => item.entityId).toSorted()).toEqual([
      'q:q-mat-studied',
      'q:q-mat-studied#0',
      'q:q-mat-studied#1',
    ]);
    expect(flashcardTombstones.every((item) => item.operation === 'DELETE')).toBe(true);

    const docTombstones = tombstones.filter((item) => item.entityType === 'document');
    expect(docTombstones.map((item) => item.entityId)).toEqual(['doc-mat-studied']);
    expect(docTombstones[0].operation).toBe('DELETE');
  });

  it('rolls the material removal back when the review tombstone write fails', async () => {
    await seedMaterial('mat-tombstone-fail');
    await db.flashcardReviews.put(reviewState('q:q-mat-tombstone-fail', 'mat-tombstone-fail'));
    await db.syncQueue.clear();

    const outboxWrite = vi.spyOn(db.syncQueue, 'bulkPut').mockRejectedValue(new Error('outbox unavailable'));
    await expect(service.removeMaterial('mat-tombstone-fail')).rejects.toThrow('outbox unavailable');
    outboxWrite.mockRestore();

    // Nothing landed: the material, its questions, and its schedule are all
    // still here. A clear that cannot be synced must not happen — the next pull
    // would otherwise restore the remote rows over a half-done removal.
    expect(await db.materials.get('mat-tombstone-fail')).toBeDefined();
    expect(await db.questions.get('q-mat-tombstone-fail')).toBeDefined();
    expect((await db.flashcardReviews.toArray()).map((r) => r.key)).toEqual(['q:q-mat-tombstone-fail']);
    expect(await db.syncQueue.toArray()).toEqual([]);
  });

  it('handles removal of material without documentId gracefully', async () => {
    const now = '2026-08-01T00:00:00.000Z';
    await db.materials.put({
      id: 'mat-no-doc',
      title: 'No Doc Material',
      documentId: '',
      order: 0,
      createdAt: now,
      updatedAt: now,
    });
    await db.questions.put({
      id: 'q-no-doc',
      materialId: 'mat-no-doc',
      type: 'true_false',
      prompt: 'Prompt',
      payload: { type: 'true_false', correctAnswer: true },
      difficulty: 'easy',
      points: 5,
      status: 'published',
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.syncQueue.clear();

    await service.removeMaterial('mat-no-doc');

    expect(await db.materials.get('mat-no-doc')).toBeUndefined();
    expect(await db.questions.get('q-no-doc')).toBeUndefined();
    expect(await db.syncQueue.toArray()).toEqual([]);
  });

  it('creates tombstone in documentContents and sync outbox even if document row was absent locally', async () => {
    const now = '2026-08-01T00:00:00.000Z';
    await db.materials.put({
      id: 'mat-unauthored',
      documentId: 'doc-unauthored',
      title: 'Unauthored Material',
      order: 0,
      createdAt: now,
      updatedAt: now,
    });
    await db.syncQueue.clear();

    await service.removeMaterial('mat-unauthored');

    expect(await db.materials.get('mat-unauthored')).toBeUndefined();

    const doc = await db.documentContents.get('doc-unauthored');
    expect(doc).toBeDefined();
    expect(doc?.deletedAt).toBeDefined();
    expect(doc?.title).toBe('Unauthored Material');

    const outbox = await db.syncQueue.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].entityType).toBe('document');
    expect(outbox[0].entityId).toBe('doc-unauthored');
    expect(outbox[0].operation).toBe('DELETE');
  });
});
