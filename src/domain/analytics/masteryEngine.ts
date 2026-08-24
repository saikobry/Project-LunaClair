import type { QuizSession } from '../quiz/QuizSession';
import type { Subject } from '../library/Subject';
import type { StudyMaterial } from '../library/StudyMaterial';
import type { TopicMastery, SubjectMastery, TopicMasteryStatus } from './analytics.types';

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
 * @param scopedSubjectId Optional subject ID filter
 * @param materialToSubjectMap Optional lookup map from materialId to subjectId
 */
export function computeTopicMastery(
    sessions: readonly QuizSession[],
    scopedSubjectId?: string,
    materialToSubjectMap?: ReadonlyMap<string, string>,
): TopicMastery[] {
    const tagMap = new Map<string, TagAccumulator>();

    for (const session of sessions) {
        if (!session.questionSnapshots || !session.answers) continue;

        for (const answer of session.answers) {
            const question = session.questionSnapshots[answer.questionId];
            if (!question) continue;

            // Scope filter if requested
            if (scopedSubjectId && materialToSubjectMap) {
                const subjectId = materialToSubjectMap.get(question.materialId);
                if (subjectId !== scopedSubjectId) continue;
            }

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
            subjectId: scopedSubjectId,
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

/**
 * Computes subject-level mastery metrics, topic breakdowns, and top strengths/weaknesses.
 * Does not mutate input arrays.
 *
 * @param subjects Array of Subject entities
 * @param materials Array of StudyMaterial entities
 * @param sessions Completed QuizSession records
 */
export function computeSubjectMasteries(
    subjects: readonly Subject[],
    materials: readonly StudyMaterial[],
    sessions: readonly QuizSession[],
): SubjectMastery[] {
    const materialToSubjectMap = new Map<string, string>();
    for (const mat of materials) {
        if (mat.subjectId) {
            materialToSubjectMap.set(mat.id, mat.subjectId);
        }
    }

    return subjects.map((subject) => {
        const topics = computeTopicMastery(sessions, subject.id, materialToSubjectMap);

        let subjectAttemptCount = 0;
        let subjectCorrectCount = 0;
        let subjectTotalWeight = 0;
        let subjectEarnedWeight = 0;
        const contributingSessionIds = new Set<string>();

        for (const session of sessions) {
            if (!session.questionSnapshots || !session.answers) continue;

            let sessionContributed = false;
            for (const answer of session.answers) {
                const question = session.questionSnapshots[answer.questionId];
                if (!question) continue;

                const subjectId = materialToSubjectMap.get(question.materialId);
                if (subjectId === subject.id) {
                    sessionContributed = true;
                    const weight = DIFFICULTY_WEIGHTS[question.difficulty] ?? 1.0;
                    subjectAttemptCount += 1;
                    subjectTotalWeight += weight;
                    if (answer.isCorrect) {
                        subjectCorrectCount += 1;
                        subjectEarnedWeight += weight;
                    }
                }
            }

            if (sessionContributed) {
                contributingSessionIds.add(session.id);
            }
        }

        const rawAccuracy = subjectAttemptCount > 0
            ? Number(((subjectCorrectCount / subjectAttemptCount) * 100).toFixed(2))
            : 0;
        const weightedScore = subjectTotalWeight > 0
            ? Number(((subjectEarnedWeight / subjectTotalWeight) * 100).toFixed(2))
            : 0;

        // Qualifying topics for strengths/weaknesses (attemptCount >= 3)
        const qualifiedTopics = topics.filter((t) => t.attemptCount >= 3);

        // Strengths: weightedScore DESC, attemptCount DESC, tag ASC
        const strengths = [...qualifiedTopics]
            .sort((a, b) => b.weightedScore - a.weightedScore || b.attemptCount - a.attemptCount || a.tag.localeCompare(b.tag))
            .slice(0, 3);

        // Weaknesses: weightedScore ASC, attemptCount DESC, tag ASC
        const weaknesses = [...qualifiedTopics]
            .sort((a, b) => a.weightedScore - b.weightedScore || b.attemptCount - a.attemptCount || a.tag.localeCompare(b.tag))
            .slice(0, 3);

        return {
            subjectId: subject.id,
            subjectName: subject.title,
            attemptCount: subjectAttemptCount,
            correctCount: subjectCorrectCount,
            rawAccuracy,
            weightedScore,
            totalQuizzes: contributingSessionIds.size,
            topics,
            strengths,
            weaknesses,
        };
    });
}
