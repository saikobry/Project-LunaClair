import type { GlobalAnalytics, SubjectMastery, MaterialAnalytics } from './analytics.types';

export interface AnalyticsRepository {
    /**
     * Aggregates system-wide analytics (overview metrics, card maturity, 7-day forecast, subject masteries, 365-day activity).
     */
    getGlobalAnalytics(signal?: AbortSignal): Promise<GlobalAnalytics>;

    /**
     * Aggregates subject-level mastery metrics, topic breakdown, and strengths/weaknesses for a specific subject.
     */
    getSubjectAnalytics(subjectId: string, signal?: AbortSignal): Promise<SubjectMastery | null>;

    /**
     * Aggregates material-level performance, card maturity, and topic masteries for a specific material.
     */
    getMaterialAnalytics(materialId: string, signal?: AbortSignal): Promise<MaterialAnalytics | null>;
}
