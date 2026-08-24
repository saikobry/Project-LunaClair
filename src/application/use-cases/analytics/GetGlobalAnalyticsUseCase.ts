import type { AnalyticsRepository } from '../../../domain/analytics/AnalyticsRepository';
import type { GlobalAnalytics } from '../../../domain/analytics/analytics.types';

export class GetGlobalAnalyticsUseCase {
    private readonly analytics: AnalyticsRepository;

    constructor(analytics: AnalyticsRepository) {
        this.analytics = analytics;
    }

    execute(signal?: AbortSignal): Promise<GlobalAnalytics> {
        return this.analytics.getGlobalAnalytics(signal);
    }
}
