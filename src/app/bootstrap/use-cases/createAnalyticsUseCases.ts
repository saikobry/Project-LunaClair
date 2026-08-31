import { GetGlobalAnalyticsUseCase } from '../../../application/use-cases/analytics/GetGlobalAnalyticsUseCase';
import { GetSubjectAnalyticsUseCase } from '../../../application/use-cases/analytics/GetSubjectAnalyticsUseCase';
import { GetMaterialAnalyticsUseCase } from '../../../application/use-cases/analytics/GetMaterialAnalyticsUseCase';
import type { Infrastructure } from '../createInfrastructure';

export function createAnalyticsUseCases(infrastructure: Infrastructure) {
    const { repositories } = infrastructure;

    return {
        getGlobalAnalytics: new GetGlobalAnalyticsUseCase(repositories.analytics),
        getSubjectAnalytics: new GetSubjectAnalyticsUseCase(repositories.analytics),
        getMaterialAnalytics: new GetMaterialAnalyticsUseCase(repositories.analytics),
    };
}
