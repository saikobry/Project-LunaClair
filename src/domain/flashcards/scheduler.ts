export interface ReviewState {
    key: string;
    repetitions: number;
    easeFactor: number;
    intervalDays: number;
    dueAt: string;
    lapses: number;
    lastReviewedAt?: string;
    reviewCount: number;
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';

const RATING_QUALITY_MAP: Record<Rating, number> = {
    again: 1,
    hard: 3,
    good: 4,
    easy: 5,
};

export function createInitialReviewState(key: string, now: Date = new Date()): ReviewState {
    return {
        key,
        repetitions: 0,
        easeFactor: 2.5,
        intervalDays: 0,
        dueAt: now.toISOString(),
        lapses: 0,
        reviewCount: 0,
    };
}

export function isDue(state: ReviewState | undefined, now: Date = new Date()): boolean {
    if (!state) return true;
    return new Date(state.dueAt).getTime() <= now.getTime();
}

export function review(
    existingState: ReviewState | undefined,
    rating: Rating,
    now: Date = new Date()
): ReviewState {
    const key = existingState?.key ?? '';
    const current = existingState ?? createInitialReviewState(key, now);
    const q = RATING_QUALITY_MAP[rating];

    // 1. Calculate new Ease Factor (EF)
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    const newEF = Math.max(
        1.3,
        current.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    );

    let newRepetitions: number;
    let newIntervalDays: number;
    let newLapses = current.lapses;

    if (q < 3) {
        // 'again'
        newRepetitions = 0;
        newIntervalDays = 1;
        newLapses += 1;
    } else {
        // 'hard', 'good', 'easy'
        newRepetitions = current.repetitions + 1;
        if (newRepetitions === 1) {
            newIntervalDays = 1;
        } else if (newRepetitions === 2) {
            newIntervalDays = 6;
        } else {
            newIntervalDays = Math.round(current.intervalDays * newEF);
        }

        if (rating === 'easy' && newRepetitions > 2) {
            newIntervalDays = Math.round(newIntervalDays * 1.3);
        }
    }

    const dueAtDate = new Date(now.getTime() + newIntervalDays * 86400000);

    return {
        key: current.key || key,
        repetitions: newRepetitions,
        easeFactor: Number(newEF.toFixed(3)),
        intervalDays: newIntervalDays,
        dueAt: dueAtDate.toISOString(),
        lapses: newLapses,
        lastReviewedAt: now.toISOString(),
        reviewCount: current.reviewCount + 1,
    };
}
