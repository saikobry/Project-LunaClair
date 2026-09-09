import { GetGlobalAnalyticsUseCase } from '../../../application/use-cases/analytics/GetGlobalAnalyticsUseCase';
import { GetMaterialAnalyticsUseCase } from '../../../application/use-cases/analytics/GetMaterialAnalyticsUseCase';
import type { Infrastructure } from '../createInfrastructure';

export function createAnalyticsUseCases(infrastructure: Infrastructure) {
    const { repositories } = infrastructure;

    return {
        getGlobalAnalytics: new GetGlobalAnalyticsUseCase(repositories.analytics),
        getMaterialAnalytics: new GetMaterialAnalyticsUseCase(repositories.analytics),
    };
}
