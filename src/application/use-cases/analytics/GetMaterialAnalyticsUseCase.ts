import type { AnalyticsRepository } from '../../../domain/analytics/repositories/AnalyticsRepository';
import type { MaterialAnalytics } from '../../../domain/analytics/models/analytics.types';

export class GetMaterialAnalyticsUseCase {
    private readonly analytics: AnalyticsRepository;

    constructor(analytics: AnalyticsRepository) {
        this.analytics = analytics;
    }

    execute(materialId: string, signal?: AbortSignal): Promise<MaterialAnalytics | null> {
        if (!materialId) return Promise.resolve(null);
        return this.analytics.getMaterialAnalytics(materialId, signal);
    }
}
