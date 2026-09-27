/**
 * Canonical domain view models and types for Project LunaClair Analytics.
 * Pure data structures with zero React or infrastructure dependencies.
 */

export interface StudyOverviewMetrics {
    /** Total completed quiz sessions across the library. */
    quizzesCompleted: number;
    /** Total individual questions answered across completed quiz sessions. */
    totalAnsweredQuestions: number;
    /** Total correct answers submitted across completed quiz sessions. */
    totalCorrectAnswers: number;
    /** Question-weighted global accuracy percentage (0 to 100). */
    globalQuizAccuracy: number;
    /** Total accumulated card reviews (sum of reviewCount across all cards). Historical: includes stranded schedules. */
    totalCardReviews: number;
    /**
     * Count of **current** cards with at least one recorded review
     * (reviewCount > 0) — i.e. projected card keys in the active pool.
     *
     * Current-workload scoped, unlike `totalCardReviews` and the streak: a
     * schedule outside the active card pool is a review that happened but is not
     * a card the learner still has, so it is excluded. Presentation must say
     * "active cards" so the number is not read as an all-time distinct-card count
     * (which would include archived and removed cards).
     */
    cardsWithReviewHistory: number;
    /** Current consecutive active calendar days in user's local timezone. */
    currentStreakDays: number;
    /** Historical maximum consecutive active calendar days. */
    longestStreakDays: number;
}

export interface CardMaturityBreakdown {
    /** Unreviewed cards (no ReviewState or reviewCount === 0). */
    newCount: number;
    /** Cards in learning phase (reviewCount > 0 && intervalDays < 7). */
    learningCount: number;
    /** Cards in review phase (7 <= intervalDays < 21, or intervalDays >= 21 with lapses > 1). */
    reviewCount: number;
    /** Cards mastered (intervalDays >= 21 && lapses <= 1). */
    masteredCount: number;
    /**
     * Size of the projected card-key pool this breakdown was computed against.
     * Invariant: `newCount + learningCount + reviewCount + masteredCount === totalCards`,
     * and `totalCards` is the pool size — never a count of questions, and never
     * repaired upward to cover reviews whose card no longer exists.
     */
    totalCards: number;
    /**
     * Diagnostic: distinct review rows whose card key is NOT in the pool — a
     * schedule outside the active card pool, which is the condition rather than
     * one cause. Three real causes produce it, and the list is open: the
     * question was **deleted**, the question was **archived** (archiving is the
     * app's soft delete, so the question still exists and only its cards left
     * the pool), or a **cloze blank was retired**.
     *
     * Reported, never absorbed: these rows are in no bucket and contribute
     * nothing to `totalCards`, so the partition stays exact. They are
     * **not** an error condition — pre-release data can carry them, and the
     * Insights surface must keep rendering rather than fail over a diagnostic.
     */
    orphanReviewCount: number;
}

export interface ReviewForecastDay {
    /** Calendar date in YYYY-MM-DD format. */
    date: string;
    /** Cards due on this exact calendar date (overdue cards collapsed into day 0 / today). */
    dueCount: number;
    /** Running cumulative cards due up to and including this date. */
    cumulativeDue: number;
}

export type TopicMasteryStatus = 'unattempted' | 'needs_practice' | 'proficient' | 'mastered';

export interface TopicMastery {
    /** The topic tag (normalized, case-preserving). */
    tag: string;
    /** Total answer attempts for this topic across completed quiz sessions. */
    attemptCount: number;
    /** Total correct answer attempts for this topic. */
    correctCount: number;
    /** Raw accuracy percentage (0 to 100), 0 if unattempted. */
    rawAccuracy: number;
    /** Difficulty-weighted proficiency score percentage (0 to 100), 0 if unattempted. */
    weightedScore: number;
    /** Evaluated mastery status. */
    status: TopicMasteryStatus;
}

export interface GlobalAnalytics {
    overview: StudyOverviewMetrics;
    maturity: CardMaturityBreakdown;
    forecast: ReviewForecastDay[];
    activity: ActivityDay[];
}

export interface ActivityDay {
    /** Calendar date in YYYY-MM-DD format. */
    date: string;
    /** Completed quiz sessions on this calendar date. */
    quizzesCount: number;
    /** Cards whose latest recorded review (lastReviewedAt) falls on this date. */
    activeCardsCount: number;
    /** Total recorded learning events on this date (quizzesCount + activeCardsCount). */
    totalActivities: number;
    /** Activity volume level (0: 0, 1: 1, 2: 2-3, 3: 4-6, 4: 7+). */
    intensityLevel: 0 | 1 | 2 | 3 | 4;
}

export interface MaterialAnalytics {
    materialId: string;
    overview: {
        quizzesCompleted: number;
        totalAnswered: number;
        correctAnswers: number;
        accuracy: number;
        totalCardReviews: number;
    };
    maturity: CardMaturityBreakdown;
    topics: TopicMastery[];
}
