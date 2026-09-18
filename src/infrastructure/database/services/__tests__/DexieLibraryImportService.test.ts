import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { LunaClairDatabase } from '../../schema/LunaClairDatabase';
import { DexieLibraryImportService } from '../DexieLibraryImportService';
import type { ImportMaterialInput } from '../../../../domain/library/services/LibraryImportService';
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

  function createSampleInput(id = 'mat-1'): ImportMaterialInput {
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

    return {
      material,
      questions: [question],
      quizzes: [quiz],
      documentContent,
    };
  }

  it('atomically imports full material bundle across all 4 stores', async () => {
    const input = createSampleInput('mat-1');
    await service.importMaterial(input);

    expect(await db.materials.get('mat-1')).toBeDefined();
    expect(await db.questions.get('q-mat-1')).toBeDefined();
    expect(await db.quizzes.get('quiz-mat-1')).toBeDefined();
    expect(await db.documentContents.get('doc-mat-1')).toBeDefined();
  });

  it('removes imported material, questions, quizzes, and document content', async () => {
    const input = createSampleInput('mat-del');
    await service.importMaterial(input);

    await service.removeMaterial('mat-del');

    // Material and associated learning content removed
    expect(await db.materials.get('mat-del')).toBeUndefined();
    expect(await db.questions.get('q-mat-del')).toBeUndefined();
    expect(await db.quizzes.get('quiz-mat-del')).toBeUndefined();
    expect(await db.documentContents.get('doc-mat-del')).toBeUndefined();
  });

  it('rolls back asset removal when the removal transaction fails', async () => {
    await service.importMaterial(createSampleInput('mat-rollback'));
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
    await service.importMaterial(createSampleInput('mat-owned'));
    await service.importMaterial(createSampleInput('mat-other'));
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
    await service.importMaterial(createSampleInput('mat-filed'));
    await service.importMaterial(createSampleInput('mat-unfiled'));

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

  it('imports material batch atomically', async () => {
    const input1 = createSampleInput('mat-batch-1');
    const input2 = createSampleInput('mat-batch-2');

    await service.importMaterialBatch([input1, input2]);

    expect(await db.materials.count()).toBe(2);
    expect(await db.questions.count()).toBe(2);
    expect(await db.quizzes.count()).toBe(2);
    expect(await db.documentContents.count()).toBe(2);
  });

  it('rolls back entire transaction if document content write fails', async () => {
    const input = createSampleInput('mat-fail');

    // Intercept documentContents.put to fail after material, etc. were staged
    vi.spyOn(db.documentContents, 'put').mockRejectedValueOnce(
      new Error('Simulated document content failure'),
    );

    await expect(service.importMaterial(input)).rejects.toThrow('Simulated document content failure');

    // Verify atomic rollback across all tables
    expect(await db.materials.count()).toBe(0);
    expect(await db.questions.count()).toBe(0);
    expect(await db.quizzes.count()).toBe(0);
    expect(await db.documentContents.count()).toBe(0);
  });
});
