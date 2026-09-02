import type { QuizSession } from '../../quiz/models/QuizSession';
import type { ReviewState } from '../../flashcards/engines/scheduler';
import type { StudyOverviewMetrics } from '../models/analytics.types';
import { computeStreak } from './streakEngine';

/**
 * Computes high-level study overview metrics.
 * Does not mutate input arrays.
 *
 * @param sessions Completed QuizSession records
 * @param reviews Canonical ReviewState records
 * @param referenceDate Reference moment (defaults to now)
 * @param timeZone Optional IANA time zone identifier
 */
export function computeStudyOverview(
    sessions: readonly QuizSession[],
    reviews: readonly ReviewState[],
    referenceDate: Date = new Date(),
    timeZone?: string,
): StudyOverviewMetrics {
    // 1. Quiz statistics (question-weighted)
    let totalAnsweredQuestions = 0;
    let totalCorrectAnswers = 0;
    const activityTimestamps: string[] = [];

    for (const session of sessions) {
        if (session.completedAt) {
            activityTimestamps.push(session.completedAt);
        } else if (session.startedAt) {
            activityTimestamps.push(session.startedAt);
        }

        if (session.answers && session.answers.length > 0) {
            for (const answer of session.answers) {
                totalAnsweredQuestions += 1;
                if (answer.isCorrect) {
                    totalCorrectAnswers += 1;
                }
            }
        }
    }

    const globalQuizAccuracy = totalAnsweredQuestions > 0
        ? Number(((totalCorrectAnswers / totalAnsweredQuestions) * 100).toFixed(2))
        : 0;

    // 2. Flashcard statistics (deduplicated defensively by key)
    const uniqueReviewMap = new Map<string, ReviewState>();
    for (const r of reviews) {
        if (r && r.key) {
            uniqueReviewMap.set(r.key, r);
        }
    }

    let totalCardReviews = 0;
    let cardsWithReviewHistory = 0;

    for (const review of uniqueReviewMap.values()) {
        totalCardReviews += review.reviewCount || 0;
        if (review.reviewCount > 0) {
            cardsWithReviewHistory += 1;
        }
        if (review.lastReviewedAt) {
            activityTimestamps.push(review.lastReviewedAt);
        }
    }

    // 3. Compute Streak
    const streak = computeStreak(activityTimestamps, referenceDate, timeZone);

    return {
        quizzesCompleted: sessions.length,
        totalAnsweredQuestions,
        totalCorrectAnswers,
        globalQuizAccuracy,
        totalCardReviews,
        cardsWithReviewHistory,
        currentStreakDays: streak.currentStreak,
        longestStreakDays: streak.longestStreak,
    };
}
