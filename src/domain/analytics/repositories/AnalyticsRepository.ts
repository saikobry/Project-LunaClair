import type { GlobalAnalytics, MaterialAnalytics } from '../models/analytics.types';

export interface AnalyticsRepository {
    /**
     * Aggregates system-wide analytics (overview metrics, card maturity, 7-day forecast, 365-day activity).
     */
    getGlobalAnalytics(signal?: AbortSignal): Promise<GlobalAnalytics>;

    /**
     * Aggregates material-level performance, card maturity, and topic masteries for a specific material.
     */
    getMaterialAnalytics(materialId: string, signal?: AbortSignal): Promise<MaterialAnalytics | null>;
}
