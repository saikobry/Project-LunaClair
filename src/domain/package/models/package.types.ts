import type { QuestionType } from '../../quiz/models/QuestionType';
import type { Question, QuestionDifficulty } from '../../quiz/models/Question';
import type { QuestionAnswerPayload } from '../../quiz/models/AnswerPayload';
import type { Quiz } from '../../quiz/models/Quiz';

export type QuestionPayload = QuestionAnswerPayload;

export type PackageMaterialId = `pkg_mat_${string}`;
export type PackageQuestionId = `pkg_q_${string}`;
export type PackageQuizId = `pkg_quiz_${string}`;
export type PackageFlashcardId = `pkg_card_${string}`;
export type PackageAssetId = `pkg_asset_${string}`;

export interface StudyPackageMetadata {
    title: string;
    description?: string;
    author?: string;
    createdAt: string;
    appVersion?: string;
    tags?: string[];
}

export interface PackageMaterial {
    id: `pkg_mat_${string}`;
    title: string;
    description?: string;
    documentContent: string;
    order?: number;
    tags?: string[];
}

export interface PackageQuestion {
    id: `pkg_q_${string}`;
    materialId: `pkg_mat_${string}`;
    type: QuestionType;
    prompt: string;
    payload: QuestionPayload;
    difficulty: QuestionDifficulty;
    points: number;
    explanation?: string;
    tags?: string[];
}

export interface PackageQuizItem {
    questionId: `pkg_q_${string}`;
    order: number;
    points?: number;
}

export interface PackageQuiz {
    id: `pkg_quiz_${string}`;
    materialId: `pkg_mat_${string}`;
    title: string;
    description?: string;
    timeLimitSeconds?: number | null;
    passingPercentage?: number | null;
    items: PackageQuizItem[];
}

export interface PackageFlashcard {
    id: `pkg_card_${string}`;
    materialId: `pkg_mat_${string}`;
    front: string;
    back: string;
    hints?: string[];
}

export interface PackageAsset {
    id: PackageAssetId;
    materialId?: PackageMaterialId;
    filename: string;
    mimeType: string;
    dataBase64: string;
}

export interface StudyPackage {
    format: 'lcpack';
    schemaVersion: 1;
    metadata: StudyPackageMetadata;
    materials: PackageMaterial[];
    questions: PackageQuestion[];
    quizzes: PackageQuiz[];
    flashcards?: PackageFlashcard[];
    assets?: PackageAsset[];
}

export interface LocalIdGenerator {
    generate(): string;
}

export interface RemappedStudyPackage {
    materials: Array<{
        id: string;
        title: string;
        description?: string;
        documentId: string;
        documentContent: string;
        order?: number;
        tags?: string[];
    }>;
    questions: Question[];
    quizzes: Quiz[];
    flashcards: Array<{
        id: string;
        materialId: string;
        front: string;
        back: string;
        hints?: string[];
    }>;
    assets: Array<{
        id: string;
        materialId?: string;
        filename: string;
        mimeType: string;
        dataBase64: string;
    }>;
    idMap: Map<string, string>;
}

export interface PackageValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface StudyPackageSummary {
    title: string;
    description?: string;
    author?: string;
    createdAt: string;
    /**
     * Tags carried by the package's materials (deduped, first-seen order).
     * Material tags are portable package data, so a preview can show what a
     * package is about *before* it is imported. Empty when no material is
     * tagged — never invented from other fields.
     */
    tags: string[];
    materialCount: number;
    questionCount: number;
    quizCount: number;
    flashcardCount: number;
    assetCount: number;
    questionsByType: Record<string, number>;
    totalPoints: number;
}

export type PackageInspection = StudyPackageSummary;
