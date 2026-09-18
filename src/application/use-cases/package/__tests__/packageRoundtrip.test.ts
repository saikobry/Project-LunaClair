import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../../../infrastructure/database/schema/LunaClairDatabase';
import { DexieLibraryRepository } from '../../../../infrastructure/database/repositories/DexieLibraryRepository';
import { DexieDocumentContentRepository } from '../../../../infrastructure/database/repositories/DexieDocumentContentRepository';
import { DexieQuestionRepository } from '../../../../infrastructure/database/repositories/DexieQuestionRepository';
import { DexieQuizRepository } from '../../../../infrastructure/database/repositories/DexieQuizRepository';
import { DexieAssetRepository } from '../../../../infrastructure/database/repositories/DexieAssetRepository';
import { DexieStudyPackageImportService } from '../../../../infrastructure/database/services/DexieStudyPackageImportService';
import { MaterializeStudyPackageUseCase } from '../MaterializeStudyPackageUseCase';
import { ImportStudyPackageUseCase } from '../ImportStudyPackageUseCase';
import { parseJsonFromString as parsePackageFromJson } from '../../../../shared/utils/jsonBlobParser';
import { serializePackageToJson } from '../../../../domain/package/engines/StudyPackageSerializer';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { ImportedDocumentContent } from '../../../../domain/reader/repositories/DocumentContentRepository';
import type { Question } from '../../../../domain/quiz/models/Question';
import type { Quiz } from '../../../../domain/quiz/models/Quiz';
import type { ImportedAsset } from '../../../../domain/importer/repositories/ImportAssetRepository';
import type { QuizSession } from '../../../../domain/quiz/models/QuizSession';
import type { ReviewState } from '../../../../domain/flashcards/engines/scheduler';
import type { SyncQueueItem } from '../../../../domain/sync/models/sync.types';

describe('StudyPackage E2E Roundtrip & Isolation', () => {
  let libraryRepo: DexieLibraryRepository;
  let docContentRepo: DexieDocumentContentRepository;
  let questionRepo: DexieQuestionRepository;
  let quizRepo: DexieQuizRepository;
  let assetRepo: DexieAssetRepository;
  let materializeUseCase: MaterializeStudyPackageUseCase;
  let importUseCase: ImportStudyPackageUseCase;

  const originalMatId = 'mat_orig_111';
  const originalDocId = 'doc_orig_222';
  const originalQ1Id = 'q_orig_333';
  const originalQ2Id = 'q_orig_444';
  const originalQuizId = 'quiz_orig_555';

  async function resetDatabase() {
    await Promise.all([
      db.materials.clear(),
      db.documentContents.clear(),
      db.questions.clear(),
      db.quizzes.clear(),
      db.localAssets.clear(),
      db.quizSessions.clear(),
      db.flashcardReviews.clear(),
      db.syncQueue.clear(),
    ]);
  }

  beforeEach(async () => {
    await resetDatabase();

    libraryRepo = new DexieLibraryRepository();
    docContentRepo = new DexieDocumentContentRepository();
    questionRepo = new DexieQuestionRepository();
    quizRepo = new DexieQuizRepository();
    assetRepo = new DexieAssetRepository();

    materializeUseCase = new MaterializeStudyPackageUseCase(
      libraryRepo,
      docContentRepo,
      questionRepo,
      quizRepo,
      assetRepo,
    );

    importUseCase = new ImportStudyPackageUseCase(new DexieStudyPackageImportService(db));
  });

  afterEach(async () => {
    await resetDatabase();
  });

  async function seedOriginalGraph() {
    const now = '2026-08-27T10:00:00.000Z';

    const material: StudyMaterial = {
      id: originalMatId,
      title: 'Cellular Respiration & Glycolysis',
      description: 'Metabolic pathways in eukaryotic cells.',
      documentId: originalDocId,
      order: 1,
      createdAt: now,
      updatedAt: now,
    };

    const docContent: ImportedDocumentContent = {
      documentId: originalDocId,
      title: 'Cellular Respiration & Glycolysis',
      content: '# Glycolysis Overview\n\nRefer to pathway: ![Pathway](lc-asset://mat_orig_111)\n\nEnd of section.',
      updatedAt: now,
    };

    const question1: Question = {
      id: originalQ1Id,
      materialId: originalMatId,
      type: 'multiple_choice',
      prompt: 'What is the net gain of ATP in glycolysis?',
      payload: {
        type: 'multiple_choice',
        choices: ['2 ATP', '4 ATP', '36 ATP', '0 ATP'],
        correctIndex: 0,
      },
      difficulty: 'medium',
      points: 10,
      status: 'published',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const question2: Question = {
      id: originalQ2Id,
      materialId: originalMatId,
      type: 'true_false',
      prompt: 'Glycolysis occurs in the mitochondria.',
      payload: {
        type: 'true_false',
        correctAnswer: false,
      },
      difficulty: 'easy',
      points: 5,
      status: 'published',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const quiz: Quiz = {
      id: originalQuizId,
      materialId: originalMatId,
      title: 'Respiration Mastery Check',
      description: 'Evaluate pathway comprehension.',
      items: [
        { quizId: originalQuizId, questionId: originalQ1Id, questionVersion: 1, order: 0, points: 10 },
        { quizId: originalQuizId, questionId: originalQ2Id, questionVersion: 1, order: 1, points: 5 },
      ],
      questionIds: [originalQ1Id, originalQ2Id],
      status: 'published',
      timeLimitSeconds: 600,
      passingPercentage: 80,
      createdAt: now,
      updatedAt: now,
    };

    const dummyBlob = new Blob(['PNG_FAKE_IMAGE_BYTES'], { type: 'image/png' });
    // Seeded through the importer's 1:1 contract: one asset per material, written as
    // `assetId = materialId` in the shared localAssets store.
    const asset: ImportedAsset = {
      materialId: originalMatId,
      blob: dummyBlob,
      filename: 'glycolysis_pathway.png',
      mimeType: 'image/png',
      importedAt: now,
    };

    // Also seed private learning state (must NOT leak into the package)
    const session: QuizSession = {
      id: 'session_secret_999',
      quizId: originalQuizId,
      mode: 'practice',
      status: 'completed',
      score: {
        correctAnswers: 2,
        incorrectAnswers: 0,
        earnedPoints: 15,
        maxPoints: 15,
        percentage: 100,
      },
      answers: [],
      questionSnapshots: {},
      startedAt: now,
      completedAt: now,
    };

    const review: ReviewState = {
      key: `q:${originalQ1Id}`,
      materialId: originalMatId,
      repetitions: 5,
      intervalDays: 14,
      easeFactor: 2.5,
      dueAt: now,
      lapses: 0,
      reviewCount: 5,
      lastReviewedAt: now,
    };

    const syncItem: SyncQueueItem = {
      id: 'sync_item_1',
      clientMutationId: 'mut_1',
      entityType: 'document',
      entityId: originalDocId,
      operation: 'UPSERT',
      clientTimestamp: now,
      payload: {},
      createdAt: now,
      retryCount: 0,
      status: 'pending',
    };

    await Promise.all([
      db.materials.put(material),
      db.documentContents.put(docContent),
      db.questions.bulkPut([question1, question2]),
      db.quizzes.put(quiz),
      db.localAssets.put({
        assetId: asset.materialId,
        materialId: asset.materialId,
        blob: asset.blob,
        mimeType: asset.mimeType,
        filename: asset.filename,
        importedAt: asset.importedAt,
      }),
      db.quizSessions.put(session),
      db.flashcardReviews.put(review),
      db.syncQueue.put(syncItem),
    ]);
  }

  it('performs complete roundtrip: Materialize -> Serialize -> Parse -> Import with full isolation', async () => {
    await seedOriginalGraph();

    // 1. Materialize package
    const pkg = await materializeUseCase.execute({
      materialId: originalMatId,
      author: 'Dr. Cellular',
      tags: ['biology', 'metabolism'],
    });

    // Invariant Assertions on Exported Package:
    expect(pkg.format).toBe('lcpack');
    expect(pkg.schemaVersion).toBe(1);
    expect(pkg.metadata.title).toBe('Cellular Respiration & Glycolysis');
    expect(pkg.metadata.author).toBe('Dr. Cellular');
    expect(pkg.materials[0].id).toBe('pkg_mat_1');
    expect(pkg.questions[0].id).toBe('pkg_q_1');
    expect(pkg.questions[1].id).toBe('pkg_q_2');
    expect(pkg.quizzes[0].id).toBe('pkg_quiz_1');
    expect(pkg.quizzes[0].items[0].questionId).toBe('pkg_q_1');
    expect(pkg.quizzes[0].items[1].questionId).toBe('pkg_q_2');
    expect(pkg.assets?.[0].id).toBe('pkg_asset_1');

    // Markdown asset reference rewired to pkg_asset_1
    expect(pkg.materials[0].documentContent).toContain('lc-asset://pkg_asset_1');

    // Zero local IDs leaked into package
    const pkgJson = serializePackageToJson(pkg, true);
    expect(pkgJson).not.toContain(originalMatId);
    expect(pkgJson).not.toContain(originalDocId);
    expect(pkgJson).not.toContain(originalQ1Id);
    expect(pkgJson).not.toContain(originalQ2Id);
    expect(pkgJson).not.toContain(originalQuizId);
    expect(pkgJson).not.toContain('session_secret_999');
    expect(pkgJson).not.toContain('sync_item_1');

    // 2. Parse package back from JSON
    const parsedPkg = parsePackageFromJson(pkgJson);

    // 3. Import package into local Dexie storage
    const importResult = await importUseCase.execute({
      package: parsedPkg,
    });

    // Invariant Assertions on Imported Entities:
    expect(importResult.materialIds).toHaveLength(1);
    const importedMatId = importResult.materialIds[0];
    expect(importedMatId).not.toBe(originalMatId);
    expect(importedMatId).not.toContain('pkg_');

    // Verify imported material in Dexie
    const importedMaterial = await db.materials.get(importedMatId);
    expect(importedMaterial).toBeDefined();
    expect(importedMaterial?.title).toBe('Cellular Respiration & Glycolysis');

    // Verify imported document content in Dexie
    const importedDoc = await db.documentContents.get(importedMaterial!.documentId);
    expect(importedDoc).toBeDefined();
    expect(importedDoc?.documentId).not.toBe(originalDocId);
    expect(importedDoc?.content).toContain(`lc-asset://${importResult.assetIds[0]}`);

    // Verify imported questions in Dexie
    const importedQuestions = await db.questions.where('materialId').equals(importedMatId).toArray();
    expect(importedQuestions).toHaveLength(2);
    for (const q of importedQuestions) {
      expect(q.id).not.toBe(originalQ1Id);
      expect(q.id).not.toBe(originalQ2Id);
      expect(q.materialId).toBe(importedMatId);
    }

    // Verify imported quiz and question items
    const importedQuizzes = await db.quizzes.where('materialId').equals(importedMatId).toArray();
    expect(importedQuizzes).toHaveLength(1);
    const importedQuiz = importedQuizzes[0];
    expect(importedQuiz.id).not.toBe(originalQuizId);
    expect(importedQuiz.materialId).toBe(importedMatId);
    expect(importedQuiz.items).toHaveLength(2);
    expect(importedQuiz.questionIds).toHaveLength(2);
    expect(new Set(importedQuiz.questionIds)).toEqual(new Set(importedQuestions.map((q) => q.id)));

    // Verify imported asset in Dexie — stored under the remapped asset identity the
    // documentContent reference points at, with materialId only grouping it.
    const importedAsset = await db.localAssets.get(importResult.assetIds[0]);
    expect(importedAsset).toBeDefined();
    expect(importedAsset?.materialId).toBe(importedMatId);
    expect(importedAsset?.filename).toBe('glycolysis_pathway.png');
    expect(importedAsset?.mimeType).toBe('image/png');

    // Verify original records were untouched and remain in Dexie
    const originalMaterial = await db.materials.get(originalMatId);
    expect(originalMaterial).toBeDefined();
    expect(originalMaterial?.title).toBe('Cellular Respiration & Glycolysis');
  });

  it('generates two completely independent graphs when importing the same package twice', async () => {
    await seedOriginalGraph();

    const pkg = await materializeUseCase.execute({ materialId: originalMatId });
    const json = serializePackageToJson(pkg);
    const parsed = parsePackageFromJson(json);

    // Import 1
    const res1 = await importUseCase.execute({ package: parsed });
    // Import 2
    const res2 = await importUseCase.execute({ package: parsed });

    expect(res1.materialIds[0]).not.toBe(res2.materialIds[0]);
    expect(res1.questionIds[0]).not.toBe(res2.questionIds[0]);
    expect(res1.quizIds[0]).not.toBe(res2.quizIds[0]);

    const allMaterials = await db.materials.toArray();
    // 1 original + 2 imports = 3 total
    expect(allMaterials).toHaveLength(3);
  });

  it('guarantees zero mutations on corrupted package validation failure', async () => {
    await seedOriginalGraph();

    const countBeforeMat = await db.materials.count();
    const countBeforeQ = await db.questions.count();
    const countBeforeQuiz = await db.quizzes.count();
    const countBeforeDoc = await db.documentContents.count();

    const corruptPkg = {
      format: 'lcpack',
      schemaVersion: 999, // Unsupported version
      metadata: { title: 'Corrupt' },
      materials: [],
      questions: [],
      quizzes: [],
    };

    await expect(importUseCase.execute({ package: corruptPkg })).rejects.toThrow(
      'StudyPackage validation failed',
    );

    // Dexie state remains 100% untouched
    expect(await db.materials.count()).toBe(countBeforeMat);
    expect(await db.questions.count()).toBe(countBeforeQ);
    expect(await db.quizzes.count()).toBe(countBeforeQuiz);
    expect(await db.documentContents.count()).toBe(countBeforeDoc);
  });

  it('round-trips a multi-figure material, keeping each reference bound to its own asset', async () => {
    const now = '2026-08-27T10:00:00.000Z';
    const multiMatId = 'mat_multi_777';
    const multiDocId = 'doc_multi_888';

    await db.materials.put({
      id: multiMatId,
      title: 'Anatomy Figures',
      description: 'Three labelled figures.',
      documentId: multiDocId,
      order: 2,
      createdAt: now,
      updatedAt: now,
    });

    // Document order deliberately differs from the export sort order (a → b → c), so a mis-paired
    // rewrite cannot pass by accident.
    await db.documentContents.put({
      documentId: multiDocId,
      title: 'Anatomy Figures',
      content: [
        '# Figures',
        '![C](lc-asset://asset-c)',
        '![A](lc-asset://asset-a)',
        '![B](lc-asset://asset-b)',
      ].join('\n'),
      updatedAt: now,
    });

    for (const [assetId, filename] of [
      ['asset-a', 'figure-a.png'],
      ['asset-b', 'figure-b.png'],
      ['asset-c', 'figure-c.png'],
    ] as const) {
      await db.localAssets.put({
        assetId,
        materialId: multiMatId,
        blob: new Blob([`bytes:${assetId}`], { type: 'image/png' }),
        mimeType: 'image/png',
        filename,
        importedAt: now,
      });
    }

    // 1. Export packages every figure, numbered deterministically by filename.
    const pkg = await materializeUseCase.execute({ materialId: multiMatId });
    expect(pkg.assets?.map((asset) => [asset.id, asset.filename])).toEqual([
      ['pkg_asset_1', 'figure-a.png'],
      ['pkg_asset_2', 'figure-b.png'],
      ['pkg_asset_3', 'figure-c.png'],
    ]);

    // 2. References are rewired to those package ids with document order preserved.
    expect(pkg.materials[0].documentContent).toContain('![C](lc-asset://pkg_asset_3)');
    expect(pkg.materials[0].documentContent).toContain('![A](lc-asset://pkg_asset_1)');
    expect(pkg.materials[0].documentContent).toContain('![B](lc-asset://pkg_asset_2)');

    // 3. Re-import into a fresh local graph.
    const parsed = parsePackageFromJson(serializePackageToJson(pkg));
    const imported = await importUseCase.execute({ package: parsed });
    expect(imported.assetIds).toHaveLength(3);

    const importedMaterial = await db.materials.get(imported.materialIds[0]);
    const importedDoc = await db.documentContents.get(importedMaterial!.documentId);
    const referencedIds = [...(importedDoc?.content ?? '').matchAll(/lc-asset:\/\/([a-zA-Z0-9_-]+)/g)].map(
      (match) => match[1],
    );

    expect(referencedIds).toHaveLength(3);
    expect(referencedIds.some((id) => id.startsWith('pkg_'))).toBe(false);

    // 4. Every reference resolves to its own stored row — same filename, same order as the source
    //    document. Filenames survive IndexedDB intact (unlike Blob bytes under fake-indexeddb), so
    //    this is what shows the asset graph is still correctly paired after two hops.
    const resolvedFilenames: string[] = [];
    for (const assetId of referencedIds) {
      const row = await db.localAssets.get(assetId);
      expect(row).toBeDefined();
      expect(row?.materialId).toBe(imported.materialIds[0]);
      resolvedFilenames.push(row!.filename);
    }
    expect(resolvedFilenames).toEqual(['figure-c.png', 'figure-a.png', 'figure-b.png']);
  });
});
