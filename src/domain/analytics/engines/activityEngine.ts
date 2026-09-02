import type { QuizSession } from '../../quiz/models/QuizSession';
import type { ReviewState } from '../../flashcards/engines/scheduler';
import type { ActivityDay } from '../models/analytics.types';
import { getCalendarDaysWindow, toLocalDateKey } from './dateUtils';

/**
 * Derives the discrete activity intensity level (0 to 4) based on recorded learning events.
 */
export function calculateIntensityLevel(totalActivities: number): 0 | 1 | 2 | 3 | 4 {
    if (totalActivities <= 0) return 0;
    if (totalActivities === 1) return 1;
    if (totalActivities <= 3) return 2;
    if (totalActivities <= 6) return 3;
    return 4;
}

/**
 * Builds a deterministic, contiguous chronological activity calendar window (default 365 days).
 * Does not mutate input arrays.
 *
 * @param sessions Array of completed QuizSession domain objects
 * @param reviews Array of canonical ReviewState domain objects
 * @param days Window size in days (default 365)
 * @param referenceDate Reference end moment (default now)
 * @param timeZone Optional IANA time zone identifier
 */
export function buildActivityCalendar(
    sessions: readonly QuizSession[],
    reviews: readonly ReviewState[],
    days = 365,
    referenceDate: Date = new Date(),
    timeZone?: string,
): ActivityDay[] {
    const windowKeys = getCalendarDaysWindow(days, referenceDate, timeZone);
    const dayMap = new Map<string, { quizzesCount: number; activeCardsCount: number }>();

    for (const key of windowKeys) {
        dayMap.set(key, { quizzesCount: 0, activeCardsCount: 0 });
    }

    // 1. Map completed quiz sessions
    for (const session of sessions) {
        const timestamp = session.completedAt || session.startedAt;
        if (timestamp) {
            try {
                const dateKey = toLocalDateKey(timestamp, timeZone);
                const entry = dayMap.get(dateKey);
                if (entry) {
                    entry.quizzesCount += 1;
                }
            } catch {
                // Ignore malformed timestamps defensively
            }
        }
    }

    // 2. Map flashcard latest review activity
    for (const review of reviews) {
        if (review.lastReviewedAt) {
            try {
                const dateKey = toLocalDateKey(review.lastReviewedAt, timeZone);
                const entry = dayMap.get(dateKey);
                if (entry) {
                    entry.activeCardsCount += 1;
                }
            } catch {
                // Ignore malformed timestamps defensively
            }
        }
    }

    // 3. Assemble ActivityDay array
    return windowKeys.map((date) => {
        const entry = dayMap.get(date) ?? { quizzesCount: 0, activeCardsCount: 0 };
        const totalActivities = entry.quizzesCount + entry.activeCardsCount;
        return {
            date,
            quizzesCount: entry.quizzesCount,
            activeCardsCount: entry.activeCardsCount,
            totalActivities,
            intensityLevel: calculateIntensityLevel(totalActivities),
        };
    });
}
