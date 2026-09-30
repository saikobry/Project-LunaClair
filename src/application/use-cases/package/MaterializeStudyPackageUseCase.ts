import type { LibraryRepository } from '../../../domain/library/repositories/LibraryRepository';
import type { DocumentContentRepository } from '../../../domain/reader/repositories/DocumentContentRepository';
import type { QuestionRepository } from '../../../domain/quiz/repositories/QuestionRepository';
import type { QuizRepository } from '../../../domain/quiz/repositories/QuizRepository';
import type { AssetRepository } from '../../../domain/assets/repositories/AssetRepository';
import type {
  PackageAsset,
  PackageMaterial,
  PackageQuestion,
  PackageQuiz,
  PackageQuizItem,
  StudyPackage,
  StudyPackageMetadata,
} from '../../../domain/package/models/package.types';
import { blobToBase64 } from '../../../domain/package/engines/StudyPackageSerializer';

export interface MaterializeStudyPackageInput {
  materialId: string;
  metadata?: Partial<StudyPackageMetadata>;
  author?: string;
  appVersion?: string;
  tags?: string[];
}

/**
 * Use case to extract and materialize a self-contained StudyPackage graph from local Dexie storage.
 *
 * Invariants:
 * - Local Dexie IDs are stripped and rewritten to package-scoped `pkg_*` identifiers.
 * - Private learning history (quiz attempts, SM-2 flashcard intervals/repetition counts, streak data, sync mutations) is excluded.
 * - All internal relationships and markdown `lc-asset://` URIs are rewired into package scope.
 * - Every stored asset of the material becomes `pkg_asset_N` (deterministic order: filename, then
 *   asset id), and each document reference is rewired by asset identity — so N figures stay
 *   paired with their own payload through clone → export → clone.
 */
export class MaterializeStudyPackageUseCase {
  private readonly libraryRepository: LibraryRepository;
  private readonly documentContentRepository: DocumentContentRepository;
  private readonly questionRepository: QuestionRepository;
  private readonly quizRepository: QuizRepository;
  private readonly assetRepository: AssetRepository;

  constructor(
    libraryRepository: LibraryRepository,
    documentContentRepository: DocumentContentRepository,
    questionRepository: QuestionRepository,
    quizRepository: QuizRepository,
    assetRepository: AssetRepository,
  ) {
    this.libraryRepository = libraryRepository;
    this.documentContentRepository = documentContentRepository;
    this.questionRepository = questionRepository;
    this.quizRepository = quizRepository;
    this.assetRepository = assetRepository;
  }

  async execute(input: MaterializeStudyPackageInput): Promise<StudyPackage> {
    const { materialId } = input;

    // 1. Fetch primary material
    const material = await this.libraryRepository.getMaterialById(materialId);
    if (!material) {
      throw new Error(`Material with ID "${materialId}" not found.`);
    }

    // 2. Fetch document content
    const docContent = await this.documentContentRepository.getByDocumentId(material.documentId);
    const rawMarkdown = docContent?.content || '';

    // 3-4. Fetch related data in parallel (questions, quizzes, and assets are independent)
    const [questions, quizzes, assets] = await Promise.all([
      this.questionRepository.getQuestions(materialId),
      this.quizRepository.getQuizzes(materialId),
      this.assetRepository.getByMaterialId(materialId),
    ]);

    // 5. Establish ID translation map (local -> pkg_*)
    const pkgMatId = 'pkg_mat_1' as const;
    const qIdMap = new Map<string, `pkg_q_${string}`>();

    const packageQuestions: PackageQuestion[] = questions.map((q, idx) => {
      const pkgQId = `pkg_q_${idx + 1}` as const;
      qIdMap.set(q.id, pkgQId);
      return {
        id: pkgQId,
        materialId: pkgMatId,
        type: q.type,
        prompt: q.prompt,
        payload: q.payload,
        difficulty: q.difficulty,
        points: q.points,
        explanation: q.explanation,
        tags: q.tags,
      };
    });

    const packageQuizzes: PackageQuiz[] = quizzes.map((quiz, idx) => {
      const pkgQuizId = `pkg_quiz_${idx + 1}` as const;
      const items: PackageQuizItem[] = [];
      for (const item of quiz.items) {
        const mappedId = qIdMap.get(item.questionId);
        if (mappedId) {
          items.push({ questionId: mappedId, order: item.order, points: item.points });
        }
      }

      return {
        id: pkgQuizId,
        materialId: pkgMatId,
        title: quiz.title,
        description: quiz.description,
        status: quiz.status,
        timeLimitSeconds: quiz.timeLimitSeconds,
        passingPercentage: quiz.passingPercentage,
        items,
      };
    });

    // Deterministic numbering: filename first, asset identity as the tie-breaker, so two assets
    // sharing a filename still get a stable `pkg_asset_N` across repeated exports.
    const orderedAssets = [...assets].sort(
      (a, b) => a.filename.localeCompare(b.filename) || a.assetId.localeCompare(b.assetId),
    );

    const pkgAssetByAssetId = new Map<string, `pkg_asset_${string}`>();
    const packageAssets: PackageAsset[] = [];

    for (const [index, asset] of orderedAssets.entries()) {
      const pkgAssetId = `pkg_asset_${index + 1}` as const;
      pkgAssetByAssetId.set(asset.assetId, pkgAssetId);

      packageAssets.push({
        id: pkgAssetId,
        materialId: pkgMatId,
        filename: asset.filename,
        mimeType: asset.mimeType,
        dataBase64: await blobToBase64(asset.blob),
      });
    }

    // Single-pass rewrite of every `lc-asset://` reference, mirroring `remapStudyPackage`'s rule:
    // same id character class, references with no matching asset left untouched. Rewriting by
    // asset identity (not by material) is what keeps an N-figure document's references paired with
    // the right payload; legacy rows migrated to v14 carry `assetId === materialId`, so old
    // `lc-asset://{materialId}` references match the same way with no extra rule.
    const rewrittenMarkdown = rawMarkdown.replace(
      /lc-asset:\/\/([a-zA-Z0-9_-]+)/g,
      (match, assetId: string) => {
        const pkgAssetId = pkgAssetByAssetId.get(assetId);
        return pkgAssetId ? `lc-asset://${pkgAssetId}` : match;
      },
    );

    const packageMaterials: PackageMaterial[] = [
      {
        id: pkgMatId,
        title: material.title,
        description: material.description,
        documentContent: rewrittenMarkdown,
        order: material.order,
        tags: material.tags,
      },
    ];

    const metadata: StudyPackageMetadata = {
      title: input.metadata?.title || material.title,
      description: input.metadata?.description || material.description,
      author: input.author || input.metadata?.author,
      createdAt: new Date().toISOString(),
      appVersion: input.appVersion,
      tags: input.tags || input.metadata?.tags,
    };

    return {
      format: 'lcpack',
      schemaVersion: 1,
      metadata,
      materials: packageMaterials,
      questions: packageQuestions,
      quizzes: packageQuizzes,
      assets: packageAssets.length > 0 ? packageAssets : undefined,
    };
  }
}
