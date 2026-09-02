import type { AnalyticsRepository } from '../../../domain/analytics/repositories/AnalyticsRepository';
import type { SubjectMastery } from '../../../domain/analytics/models/analytics.types';

export class GetSubjectAnalyticsUseCase {
    private readonly analytics: AnalyticsRepository;

    constructor(analytics: AnalyticsRepository) {
        this.analytics = analytics;
    }

    execute(subjectId: string, signal?: AbortSignal): Promise<SubjectMastery | null> {
        if (!subjectId) return Promise.resolve(null);
        return this.analytics.getSubjectAnalytics(subjectId, signal);
    }
}
