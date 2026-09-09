import type { QuizSession } from '../../quiz/models/QuizSession';
import type { TopicMastery, TopicMasteryStatus } from '../models/analytics.types';

export const DIFFICULTY_WEIGHTS: Record<string, number> = {
    easy: 1.0,
    medium: 1.5,
    hard: 2.0,
};

/**
 * Derives topic mastery status from weighted score and attempt count.
 */
export function deriveTopicMasteryStatus(weightedScore: number, attemptCount: number): TopicMasteryStatus {
    if (attemptCount === 0) return 'unattempted';
    if (weightedScore >= 85 && attemptCount >= 3) return 'mastered';
    if (weightedScore >= 70) return 'proficient';
    if (weightedScore >= 85 && attemptCount < 3) return 'proficient';
    return 'needs_practice';
}

interface TagAccumulator {
    tag: string;
    attemptCount: number;
    correctCount: number;
    totalWeight: number;
    earnedWeight: number;
}

/**
 * Computes topic mastery aggregations from immutable question snapshots across completed quiz sessions.
 * Does not mutate input arrays.
 *
 * @param sessions Completed quiz sessions
 */
export function computeTopicMastery(
    sessions: readonly QuizSession[],
): TopicMastery[] {
    const tagMap = new Map<string, TagAccumulator>();

    for (const session of sessions) {
        if (!session.questionSnapshots || !session.answers) continue;

        for (const answer of session.answers) {
            const question = session.questionSnapshots[answer.questionId];
            if (!question) continue;

            const weight = DIFFICULTY_WEIGHTS[question.difficulty] ?? 1.0;
            const tags = question.tags && question.tags.length > 0 ? question.tags : ['uncategorized'];

            for (const rawTag of tags) {
                const tag = rawTag.trim();
                if (!tag) continue;

                let accum = tagMap.get(tag);
                if (!accum) {
                    accum = {
                        tag,
                        attemptCount: 0,
                        correctCount: 0,
                        totalWeight: 0,
                        earnedWeight: 0,
                    };
                    tagMap.set(tag, accum);
                }

                accum.attemptCount += 1;
                accum.totalWeight += weight;
                if (answer.isCorrect) {
                    accum.correctCount += 1;
                    accum.earnedWeight += weight;
                }
            }
        }
    }

    const results: TopicMastery[] = [];
    for (const [tag, accum] of tagMap.entries()) {
        const rawAccuracy = accum.attemptCount > 0
            ? Number(((accum.correctCount / accum.attemptCount) * 100).toFixed(2))
            : 0;
        const weightedScore = accum.totalWeight > 0
            ? Number(((accum.earnedWeight / accum.totalWeight) * 100).toFixed(2))
            : 0;

        results.push({
            tag,
            attemptCount: accum.attemptCount,
            correctCount: accum.correctCount,
            rawAccuracy,
            weightedScore,
            status: deriveTopicMasteryStatus(weightedScore, accum.attemptCount),
        });
    }

    // Sort alphabetically by tag for deterministic output
    return results.sort((a, b) => a.tag.localeCompare(b.tag));
}
