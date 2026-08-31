import { GetGlobalAnalyticsUseCase } from '../../../application/use-cases/analytics/GetGlobalAnalyticsUseCase';
import { GetSubjectAnalyticsUseCase } from '../../../application/use-cases/analytics/GetSubjectAnalyticsUseCase';
import { GetMaterialAnalyticsUseCase } from '../../../application/use-cases/analytics/GetMaterialAnalyticsUseCase';
import type { Repositories } from '../createRepositories';

export function createAnalyticsUseCases(repositories: Repositories) {
    return {
        getGlobalAnalytics: new GetGlobalAnalyticsUseCase(repositories.analyticsRepository),
        getSubjectAnalytics: new GetSubjectAnalyticsUseCase(repositories.analyticsRepository),
        getMaterialAnalytics: new GetMaterialAnalyticsUseCase(repositories.analyticsRepository),
    };
}
