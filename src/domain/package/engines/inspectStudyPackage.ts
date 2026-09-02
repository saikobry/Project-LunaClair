import type { StudyPackage, StudyPackageSummary } from '../models/package.types';

/**
 * Pure function to inspect a StudyPackage and compute summary metrics for preview/import screens.
 */
export function inspectStudyPackage(pkg: StudyPackage): StudyPackageSummary {
    const questionsByType: Record<string, number> = {};
    let totalPoints = 0;

    for (const q of pkg.questions) {
        questionsByType[q.type] = (questionsByType[q.type] ?? 0) + 1;
        totalPoints += typeof q.points === 'number' && !Number.isNaN(q.points) ? q.points : 0;
    }

    return {
        title: pkg.metadata.title,
        description: pkg.metadata.description,
        author: pkg.metadata.author,
        createdAt: pkg.metadata.createdAt,
        materialCount: pkg.materials.length,
        questionCount: pkg.questions.length,
        quizCount: pkg.quizzes.length,
        flashcardCount: pkg.flashcards?.length ?? 0,
        assetCount: pkg.assets?.length ?? 0,
        questionsByType,
        totalPoints,
    };
}
