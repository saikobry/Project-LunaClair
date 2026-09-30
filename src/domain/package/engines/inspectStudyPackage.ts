import type { StudyPackage, StudyPackageSummary } from '../models/package.types';

/**
 * Tags carried by a package's materials, deduped in first-seen order.
 *
 * Package-level `metadata.tags` are deliberately **not** merged in: that field is
 * accepted by the format but never populated by the app, and a preview must show
 * what the imported material will actually carry.
 *
 * Tags are cleaned the way the app cleans tag tokens (`shared/utils/tags`):
 * trimmed and stripped of a leading '#', so a hand-edited package cannot render
 * as `##cells`. Order is first-seen material order — stable, and it keeps the
 * author's own ordering instead of imposing an alphabetical one.
 */
function collectMaterialTags(pkg: StudyPackage): string[] {
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const material of pkg.materials) {
        for (const tag of material.tags ?? []) {
            if (typeof tag !== 'string') continue;
            const cleaned = tag.trim().replace(/^#/, '');
            if (!cleaned) continue;
            const key = cleaned.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            tags.push(cleaned);
        }
    }
    return tags;
}

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
        tags: collectMaterialTags(pkg),
        materialCount: pkg.materials.length,
        questionCount: pkg.questions.length,
        quizCount: pkg.quizzes.length,
        assetCount: pkg.assets?.length ?? 0,
        questionsByType,
        totalPoints,
    };
}
