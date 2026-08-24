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
    /** Total accumulated card reviews (sum of reviewCount across all cards). */
    totalCardReviews: number;
    /** Count of distinct cards with at least one recorded review (reviewCount > 0). */
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
    /** Total pool of cards evaluated. Invariant: sum of all counts === totalCards. */
    totalCards: number;
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
    /** Optional associated subject ID if scoped. */
    subjectId?: string;
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

export interface SubjectMastery {
    subjectId: string;
    subjectName: string;
    /** Total answer attempts across this subject's materials. */
    attemptCount: number;
    /** Total correct answer attempts across this subject's materials. */
    correctCount: number;
    /** Raw accuracy percentage for this subject (0 to 100). */
    rawAccuracy: number;
    /** Difficulty-weighted proficiency score percentage for this subject (0 to 100). */
    weightedScore: number;
    /** Total completed quiz sessions contributing to this subject. */
    totalQuizzes: number;
    /** Topic masteries belonging to this subject. */
    topics: TopicMastery[];
    /** Top 3 topics with attemptCount >= 3 (sorted by weightedScore DESC, attemptCount DESC, tag ASC). */
    strengths: TopicMastery[];
    /** Top 3 topics with attemptCount >= 3 (sorted by weightedScore ASC, attemptCount DESC, tag ASC). */
    weaknesses: TopicMastery[];
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

export interface GlobalAnalytics {
    overview: StudyOverviewMetrics;
    maturity: CardMaturityBreakdown;
    forecast: ReviewForecastDay[];
    subjects: SubjectMastery[];
    activity: ActivityDay[];
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
