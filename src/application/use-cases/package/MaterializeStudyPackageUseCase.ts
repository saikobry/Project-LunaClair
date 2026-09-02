import type { LibraryRepository } from '../../../domain/library/repositories/LibraryRepository';
import type { DocumentContentRepository } from '../../../domain/reader/repositories/DocumentContentRepository';
import type { QuestionRepository } from '../../../domain/quiz/repositories/QuestionRepository';
import type { QuizRepository } from '../../../domain/quiz/repositories/QuizRepository';
import type { ImportAssetRepository } from '../../../domain/importer/repositories/ImportAssetRepository';
import type {
  PackageAsset,
  PackageFlashcard,
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
 */
export class MaterializeStudyPackageUseCase {
  private readonly libraryRepository: LibraryRepository;
  private readonly documentContentRepository: DocumentContentRepository;
  private readonly questionRepository: QuestionRepository;
  private readonly quizRepository: QuizRepository;
  private readonly importAssetRepository: ImportAssetRepository;

  constructor(
    libraryRepository: LibraryRepository,
    documentContentRepository: DocumentContentRepository,
    questionRepository: QuestionRepository,
    quizRepository: QuizRepository,
    importAssetRepository: ImportAssetRepository,
  ) {
    this.libraryRepository = libraryRepository;
    this.documentContentRepository = documentContentRepository;
    this.questionRepository = questionRepository;
    this.quizRepository = quizRepository;
    this.importAssetRepository = importAssetRepository;
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

    // 3-4. Fetch related data in parallel (questions, quizzes, and asset are independent)
    const [questions, quizzes, importedAsset] = await Promise.all([
      this.questionRepository.getQuestions(materialId),
      this.quizRepository.getQuizzes(materialId),
      this.importAssetRepository.get(materialId),
    ]);

    // 5. Establish ID translation map (local -> pkg_*)
    const pkgMatId = 'pkg_mat_1' as const;
    const qIdMap = new Map<string, `pkg_q_${string}`>();
    const assetIdMap = new Map<string, `pkg_asset_${string}`>();

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

    const packageAssets: PackageAsset[] = [];
    let rewrittenMarkdown = rawMarkdown;

    if (importedAsset) {
      const pkgAssetId = 'pkg_asset_1' as const;
      assetIdMap.set(importedAsset.materialId, pkgAssetId);
      const dataBase64 = await blobToBase64(importedAsset.blob);

      packageAssets.push({
        id: pkgAssetId,
        materialId: pkgMatId,
        filename: importedAsset.filename,
        mimeType: importedAsset.mimeType,
        dataBase64,
      });

      // Rewrite markdown asset references: lc-asset://${materialId} -> lc-asset://${pkgAssetId}
      const regex = new RegExp(`lc-asset://${importedAsset.materialId}`, 'g');
      rewrittenMarkdown = rewrittenMarkdown.replace(regex, `lc-asset://${pkgAssetId}`);
    }

    const packageMaterials: PackageMaterial[] = [
      {
        id: pkgMatId,
        title: material.title,
        description: material.description,
        documentContent: rewrittenMarkdown,
        order: material.order,
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

    const packageFlashcards: PackageFlashcard[] = [];

    return {
      format: 'lcpack',
      schemaVersion: 1,
      metadata,
      materials: packageMaterials,
      questions: packageQuestions,
      quizzes: packageQuizzes,
      flashcards: packageFlashcards,
      assets: packageAssets.length > 0 ? packageAssets : undefined,
    };
  }
}
