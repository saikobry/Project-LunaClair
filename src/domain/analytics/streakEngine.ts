import { toLocalDateKey, addDays, diffCalendarDays } from './dateUtils';

export interface StreakResult {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate?: string;
}

/**
 * Pure calculation of consecutive active calendar days and historical maximum streak.
 * Does not mutate input array.
 *
 * @param activityTimestamps Array of UTC ISO timestamp strings (e.g. from session.completedAt or review.lastReviewedAt)
 * @param referenceDate Reference moment (defaults to current time)
 * @param timeZone Optional IANA time zone identifier
 */
export function computeStreak(
    activityTimestamps: readonly string[],
    referenceDate: Date = new Date(),
    timeZone?: string,
): StreakResult {
    if (!activityTimestamps || activityTimestamps.length === 0) {
        return { currentStreak: 0, longestStreak: 0, lastActiveDate: undefined };
    }

    // 1. Map timestamps to unique local date keys
    const dateSet = new Set<string>();
    for (const ts of activityTimestamps) {
        if (ts) {
            try {
                dateSet.add(toLocalDateKey(ts, timeZone));
            } catch {
                // Ignore malformed timestamps defensively
            }
        }
    }

    if (dateSet.size === 0) {
        return { currentStreak: 0, longestStreak: 0, lastActiveDate: undefined };
    }

    // 2. Sort unique date keys chronologically ascending (copy to ensure non-mutation)
    const sortedDates = Array.from(dateSet).sort();
    const lastActiveDate = sortedDates[sortedDates.length - 1];

    const todayKey = toLocalDateKey(referenceDate, timeZone);
    const yesterdayKey = toLocalDateKey(addDays(referenceDate, -1), timeZone);

    // 3. Compute Longest Historical Streak
    let longestStreak = 0;
    let currentSequence = 0;

    for (let i = 0; i < sortedDates.length; i++) {
        if (i === 0) {
            currentSequence = 1;
        } else {
            const diff = diffCalendarDays(sortedDates[i - 1], sortedDates[i]);
            if (diff === 1) {
                currentSequence += 1;
            } else if (diff > 1) {
                currentSequence = 1;
            }
            // diff === 0 cannot happen because set is deduplicated
        }
        if (currentSequence > longestStreak) {
            longestStreak = currentSequence;
        }
    }

    // 4. Compute Current Streak with Today/Yesterday grace logic
    let currentStreak = 0;

    if (lastActiveDate === todayKey || lastActiveDate === yesterdayKey) {
        // Walk backward from the latest active date
        currentStreak = 1;
        let expectedDateKey = lastActiveDate;

        for (let i = sortedDates.length - 2; i >= 0; i--) {
            const prevDateKey = sortedDates[i];
            const diff = diffCalendarDays(prevDateKey, expectedDateKey);
            if (diff === 1) {
                currentStreak += 1;
                expectedDateKey = prevDateKey;
            } else {
                break;
            }
        }
    } else {
        // Last active was before yesterday -> current streak is 0
        currentStreak = 0;
    }

    return {
        currentStreak,
        longestStreak,
        lastActiveDate,
    };
}
