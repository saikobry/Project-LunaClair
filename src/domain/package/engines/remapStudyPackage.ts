import type { LocalIdGenerator, RemappedStudyPackage, StudyPackage } from '../models/package.types';
import type { Question } from '../../quiz/models/Question';
import type { Quiz } from '../../quiz/models/Quiz';

const defaultIdGenerator: LocalIdGenerator = {
    generate: () => crypto.randomUUID(),
};

/**
 * Pure remapper for importing a StudyPackage into local state.
 * 
 * Invariants:
 * - Generates fresh collision-free UUIDs for every material, document, question, quiz, flashcard, and asset.
 * - Rewires all foreign keys across questions, quizzes, quiz items, flashcards, and assets.
 * - Rewrites embedded markdown `lc-asset://pkg_asset_...` references to point to newly generated asset IDs.
 * - Returns a full `idMap` tracking package ID -> local UUID mappings.
 */
export function remapStudyPackage(
    pkg: StudyPackage,
    idGenerator: LocalIdGenerator = defaultIdGenerator
): RemappedStudyPackage {
    const idMap = new Map<string, string>();
    const now = new Date().toISOString();

    // 1. Generate new UUIDs for all package entities
    pkg.materials.forEach((mat) => {
        idMap.set(mat.id, idGenerator.generate());
    });

    pkg.questions.forEach((q) => {
        idMap.set(q.id, idGenerator.generate());
    });

    pkg.quizzes.forEach((quiz) => {
        idMap.set(quiz.id, idGenerator.generate());
    });

    (pkg.flashcards ?? []).forEach((card) => {
        idMap.set(card.id, idGenerator.generate());
    });

    (pkg.assets ?? []).forEach((asset) => {
        idMap.set(asset.id, idGenerator.generate());
    });

    // 2. Remap materials and rewrite embedded asset links in documentContent
    const materials = pkg.materials.map((mat) => {
        const newMatId = idMap.get(mat.id)!;
        const newDocId = idGenerator.generate();

        const remappedContent = mat.documentContent.replace(
            /lc-asset:\/\/(pkg_asset_[a-zA-Z0-9_-]+)/g,
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

    // 5. Remap flashcards
    const flashcards = (pkg.flashcards ?? []).map((card) => {
        const newCardId = idMap.get(card.id)!;
        const newMatId = idMap.get(card.materialId) ?? card.materialId;

        return {
            id: newCardId,
            materialId: newMatId,
            front: card.front,
            back: card.back,
            hints: card.hints ? [...card.hints] : undefined,
        };
    });

    // 6. Remap assets
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
        flashcards,
        assets,
        idMap,
    };
}
