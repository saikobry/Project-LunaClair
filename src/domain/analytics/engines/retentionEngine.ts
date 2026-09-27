import type { ReviewState } from '../../flashcards/engines/scheduler';
import type { CardMaturityBreakdown, ReviewForecastDay } from '../models/analytics.types';
import { toLocalDateKey, addDays } from './dateUtils';

/**
 * Computes mutually exclusive flashcard maturity buckets across a **projected
 * card pool**. Does not mutate input arrays or sets.
 *
 * The pool is the set of card keys, not a count, and not a count of questions:
 * `buildCardKeyPool` derives it from the same `questionToCards` projection the
 * study deck uses, so a `fill_in_blank` question contributes one key per blank
 * and the "N total flashcards" figure is the deck's own cardinality. Passing a
 * set is what makes a wrong pool a *visible* bug — a bare number cannot be
 * checked against anything.
 *
 * Precedence Partitioning (evaluated per pool key):
 * 1. New: no ReviewState for the key, or its reviewCount === 0
 * 2. Learning: reviewCount > 0 && intervalDays < 7
 * 3. Review: (intervalDays >= 7 && intervalDays < 21) || (intervalDays >= 21 && lapses > 1)
 * 4. Mastered: intervalDays >= 21 && lapses <= 1
 *
 * **A review only counts if its key is in the pool.** A review whose key is not
 * is an *orphan* — a schedule outside the active card pool, which is the
 * condition and not one cause. Three real causes produce it, and the list is
 * not closed by this engine: the question was **deleted**, the question was
 * **archived** (archiving is the app's soft delete, so the question still
 * exists and only its keys left the pool — `buildCardKeyPool` is what excludes
 * it), or a **cloze blank was retired**. Presentation must therefore name the
 * condition and never assert a single one of them. Orphans are returned as
 * `orphanReviewCount` instead of being folded into a bucket. They never widen
 * `totalCards`, so `newCount + learningCount + reviewCount + masteredCount ===
 * cardKeys.size` holds exactly. Orphans are a *diagnostic*, not a failure: rows
 * left behind by pre-release data exist and must not break the Insights screen,
 * so this never throws — strictness is asserted in tests instead.
 *
 * There is deliberately **no `Math.max` repair** on `totalCards` (the previous
 * signature widened the pool to cover orphan reviews, which made an incorrect
 * pool undetectable and relabelled a question count as a flashcard count).
 *
 * @param reviews Array of ReviewState records
 * @param cardKeys The projected card keys in scope (see `buildCardKeyPool`)
 */
export function computeCardMaturity(
    reviews: readonly ReviewState[],
    cardKeys: ReadonlySet<string>,
): CardMaturityBreakdown {
    // 1. Deduplicate reviews defensively by key
    const reviewsByKey = new Map<string, ReviewState>();
    for (const r of reviews) {
        if (r && r.key) {
            reviewsByKey.set(r.key, r);
        }
    }

    let newCount = 0;
    let learningCount = 0;
    let reviewCount = 0;
    let masteredCount = 0;

    // 2. Walk the POOL, not the reviews: the pool is the denominator, so a
    //    pool key with no review is `new` and a review outside the pool is
    //    invisible here by construction.
    for (const key of cardKeys) {
        const review = reviewsByKey.get(key);

        // No persisted ReviewState at all is the same fact as reviewCount === 0.
        if (!review || review.reviewCount === 0) {
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

    // 3. Orphans: schedules outside the active card pool. Reported only.
    let orphanReviewCount = 0;
    for (const key of reviewsByKey.keys()) {
        if (!cardKeys.has(key)) orphanReviewCount += 1;
    }

    return {
        newCount,
        learningCount,
        reviewCount,
        masteredCount,
        totalCards: cardKeys.size,
        orphanReviewCount,
    };
}

/**
 * Computes upcoming review forecast load across the next N days.
 * Does not mutate input arrays or sets.
 *
 * **Scoped to extant cards.** The forecast answers "how much work is coming",
 * which is a claim about the deck the learner *has*; a schedule for a card
 * nothing projects any more is not upcoming work, so it is dropped. (The
 * activity calendar is the opposite case — it is historical, and a review of a
 * since-deleted card did happen, so it keeps counting there.)
 *
 * Overdue rule: If dueAt <= referenceDate (instant comparison), the card is collapsed into day 0 (today).
 *
 * @param reviews Array of ReviewState records
 * @param cardKeys The projected card keys still in scope (see `buildCardKeyPool`)
 * @param daysAhead Window size in days (default 7)
 * @param referenceDate Reference moment (defaults to now)
 * @param timeZone Optional IANA time zone identifier
 */
export function computeReviewForecast(
    reviews: readonly ReviewState[],
    cardKeys: ReadonlySet<string>,
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
    const reviewsByKey = new Map<string, ReviewState>();
    for (const r of reviews) {
        if (r && r.key && cardKeys.has(r.key)) {
            reviewsByKey.set(r.key, r);
        }
    }

    // 3. Group reviews into calendar days
    for (const review of reviewsByKey.values()) {
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
