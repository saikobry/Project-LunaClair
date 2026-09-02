import type { ReviewState } from '../../flashcards/engines/scheduler';
import type { CardMaturityBreakdown, ReviewForecastDay } from '../models/analytics.types';
import { toLocalDateKey, addDays } from './dateUtils';

/**
 * Computes mutually exclusive flashcard maturity buckets across the card pool.
 * Does not mutate input arrays.
 *
 * Precedence Partitioning:
 * 1. New: reviewCount === 0 (plus unreviewed cards without a ReviewState)
 * 2. Learning: reviewCount > 0 && intervalDays < 7
 * 3. Review: (intervalDays >= 7 && intervalDays < 21) || (intervalDays >= 21 && lapses > 1)
 * 4. Mastered: intervalDays >= 21 && lapses <= 1
 *
 * @param reviews Array of ReviewState records
 * @param totalCards Total canonical flashcard pool size
 */
export function computeCardMaturity(
    reviews: readonly ReviewState[],
    totalCards: number,
): CardMaturityBreakdown {
    // 1. Deduplicate reviews defensively by key
    const uniqueReviewMap = new Map<string, ReviewState>();
    for (const r of reviews) {
        if (r && r.key) {
            uniqueReviewMap.set(r.key, r);
        }
    }

    let newCount = 0;
    let learningCount = 0;
    let reviewCount = 0;
    let masteredCount = 0;

    for (const review of uniqueReviewMap.values()) {
        if (review.reviewCount === 0) {
            newCount += 1;
        } else if (review.intervalDays < 7) {
            learningCount += 1;
        } else if (review.intervalDays < 21 || review.lapses > 1) {
            reviewCount += 1;
        } else {
            // intervalDays >= 21 && lapses <= 1
            masteredCount += 1;
        }
    }

    // Unreviewed cards without a persisted ReviewState record belong in newCount
    const effectiveTotal = Math.max(totalCards, uniqueReviewMap.size);
    const unrecordedCount = effectiveTotal - uniqueReviewMap.size;
    newCount += unrecordedCount;

    return {
        newCount,
        learningCount,
        reviewCount,
        masteredCount,
        totalCards: effectiveTotal,
    };
}

/**
 * Computes upcoming review forecast load across the next N days.
 * Does not mutate input arrays.
 *
 * Overdue rule: If dueAt <= referenceDate (instant comparison), the card is collapsed into day 0 (today).
 *
 * @param reviews Array of ReviewState records
 * @param daysAhead Window size in days (default 7)
 * @param referenceDate Reference moment (defaults to now)
 * @param timeZone Optional IANA time zone identifier
 */
export function computeReviewForecast(
    reviews: readonly ReviewState[],
    daysAhead = 7,
    referenceDate: Date = new Date(),
    timeZone?: string,
): ReviewForecastDay[] {
    if (daysAhead <= 0) return [];

    // 1. Build forward chronological date keys [today, today+1, ..., today+(daysAhead-1)]
    const dateKeys: string[] = [];
    const countsMap = new Map<string, number>();

    for (let i = 0; i < daysAhead; i++) {
        const d = addDays(referenceDate, i);
        const key = toLocalDateKey(d, timeZone);
        dateKeys.push(key);
        countsMap.set(key, 0);
    }

    const todayKey = dateKeys[0];
    const refTime = referenceDate.getTime();

    // 2. Deduplicate reviews defensively by key
    const uniqueReviewMap = new Map<string, ReviewState>();
    for (const r of reviews) {
        if (r && r.key) {
            uniqueReviewMap.set(r.key, r);
        }
    }

    // 3. Group reviews into calendar days
    for (const review of uniqueReviewMap.values()) {
        if (!review.dueAt) continue;

        try {
            const dueTime = new Date(review.dueAt).getTime();
            if (isNaN(dueTime)) continue;

            if (dueTime <= refTime) {
                // Overdue cards are actionable today -> collapse into day 0
                countsMap.set(todayKey, (countsMap.get(todayKey) ?? 0) + 1);
            } else {
                const localDueKey = toLocalDateKey(review.dueAt, timeZone);
                if (countsMap.has(localDueKey)) {
                    countsMap.set(localDueKey, (countsMap.get(localDueKey) ?? 0) + 1);
                }
            }
        } catch {
            // Ignore malformed timestamps defensively
        }
    }

    // 4. Compute running cumulative due counts
    let runningCumulative = 0;
    return dateKeys.map((date) => {
        const dueCount = countsMap.get(date) ?? 0;
        runningCumulative += dueCount;
        return {
            date,
            dueCount,
            cumulativeDue: runningCumulative,
        };
    });
}
