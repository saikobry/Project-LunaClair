import type { LocalIdGenerator, RemappedStudyPackage, StudyPackage } from '../models/package.types';
import type { Question } from '../../quiz/models/Question';
import type { Quiz } from '../../quiz/models/Quiz';
import { FLOOR_ISO } from '../../sync/utils/hlc';

const defaultIdGenerator: LocalIdGenerator = {
    generate: () => crypto.randomUUID(),
};

/**
 * Pure remapper for importing a StudyPackage into local state.
 * 
 * Invariants:
 * - When `originShareId` is provided:
 *   - Generates deterministic IDs:
 *     - material.id = 'mat_share_' + originShareId
 *     - material.documentId = 'doc_share_' + originShareId
 *     - question.id = 'q_share_' + originShareId + '_' + q.id
 *     - quiz.id = 'quiz_share_' + originShareId + '_' + quiz.id
 *     - asset.id = 'asset_share_' + originShareId + '_' + asset.id
 *   - Sets createdAt/updatedAt to canonical FLOOR_ISO.
 * - When `originShareId` is omitted:
 *   - Generates fresh collision-free UUIDs for every material, document, question, quiz, and asset.
 *   - Sets createdAt/updatedAt to current ISO timestamp.
 * - Rewires all foreign keys across questions, quizzes, quiz items, and assets.
 * - Rewrites embedded markdown `lc-asset://...` references to point to newly generated asset IDs.
 * - Returns a full `idMap` tracking package ID -> local UUID mappings.
 */
export function remapStudyPackage(
    pkg: StudyPackage,
    idGenerator: LocalIdGenerator = defaultIdGenerator,
    originShareId?: string,
): RemappedStudyPackage {
    const generator = idGenerator ?? defaultIdGenerator;
    const idMap = new Map<string, string>();
    const now = originShareId ? FLOOR_ISO : new Date().toISOString();

    // 1. Generate new IDs for all package entities
    pkg.materials.forEach((mat, index) => {
        const matId = originShareId
            ? (index === 0 ? `mat_share_${originShareId}` : `mat_share_${originShareId}_${mat.id}`)
            : generator.generate();
        idMap.set(mat.id, matId);
    });

    pkg.questions.forEach((q) => {
        const qId = originShareId
            ? `q_share_${originShareId}_${q.id}`
            : generator.generate();
        idMap.set(q.id, qId);
    });

    pkg.quizzes.forEach((quiz) => {
        const quizId = originShareId
            ? `quiz_share_${originShareId}_${quiz.id}`
            : generator.generate();
        idMap.set(quiz.id, quizId);
    });

    (pkg.assets ?? []).forEach((asset) => {
        const assetId = originShareId
            ? `asset_share_${originShareId}_${asset.id}`
            : generator.generate();
        idMap.set(asset.id, assetId);
    });

    // 2. Remap materials and rewrite embedded asset links in documentContent
    const materials = pkg.materials.map((mat, index) => {
        const newMatId = idMap.get(mat.id)!;
        const newDocId = originShareId
            ? (index === 0 ? `doc_share_${originShareId}` : `doc_share_${originShareId}_${mat.id}`)
            : generator.generate();

        const remappedContent = mat.documentContent.replace(
            /lc-asset:\/\/([a-zA-Z0-9_-]+)/g,
            (match, assetId) => {
                const mappedId = idMap.get(assetId);
                return mappedId ? `lc-asset://${mappedId}` : match;
            }
        );

        return {
            id: newMatId,
            title: mat.title,
            description: mat.description,
            documentId: newDocId,
            documentContent: remappedContent,
            order: mat.order,
            tags: mat.tags ? [...mat.tags] : undefined,
        };
    });

    // 3. Remap questions to domain Question entities
    const questions: Question[] = pkg.questions.map((q) => {
        const newQId = idMap.get(q.id)!;
        const newMatId = idMap.get(q.materialId) ?? q.materialId;

        return {
            id: newQId,
            materialId: newMatId,
            type: q.type,
            prompt: q.prompt,
            payload: q.payload,
            difficulty: q.difficulty,
            points: q.points,
            explanation: q.explanation,
            tags: q.tags ? [...q.tags] : undefined,
            status: 'published',
            version: 1,
            createdAt: now,
            updatedAt: now,
        };
    });

    // 4. Remap quizzes and quiz items
    const quizzes: Quiz[] = pkg.quizzes.map((quiz) => {
        const newQuizId = idMap.get(quiz.id)!;
        const newMatId = idMap.get(quiz.materialId) ?? quiz.materialId;

        const remappedItems = quiz.items.map((item) => {
            const newQId = idMap.get(item.questionId) ?? item.questionId;
            return {
                quizId: newQuizId,
                questionId: newQId,
                questionVersion: 1,
                order: item.order,
                points: item.points,
            };
        });

        const questionIds = remappedItems.map((item) => item.questionId);

        return {
            id: newQuizId,
            materialId: newMatId,
            title: quiz.title,
            description: quiz.description,
            questionIds,
            items: remappedItems,
            status: 'published',
            timeLimitSeconds: quiz.timeLimitSeconds ?? undefined,
            passingPercentage: quiz.passingPercentage ?? undefined,
            createdAt: now,
            updatedAt: now,
        };
    });

    // 5. Remap assets
    const defaultMatId = materials[0]?.id ?? '';
    const assets = (pkg.assets ?? []).map((asset) => {
        const newAssetId = idMap.get(asset.id)!;
        const newMatId = asset.materialId ? (idMap.get(asset.materialId) ?? defaultMatId) : defaultMatId;

        return {
            id: newAssetId,
            materialId: newMatId,
            filename: asset.filename,
            mimeType: asset.mimeType,
            dataBase64: asset.dataBase64,
        };
    });

    return {
        materials,
        questions,
        quizzes,
        assets,
        idMap,
    };
}
