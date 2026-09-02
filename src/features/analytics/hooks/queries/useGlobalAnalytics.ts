import { useQuery } from '@tanstack/react-query';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { analyticsQueryKeys } from '../../queries/analyticsQueryKeys';
import type { GlobalAnalytics } from '../../../../domain/analytics/models/analytics.types';

export function useGlobalAnalytics() {
    const context = useContextOrThrow(ApplicationContext, 'useGlobalAnalytics');

    const { data, isLoading, isError, error, refetch } = useQuery<GlobalAnalytics, Error>({
        queryKey: analyticsQueryKeys.global(),
        queryFn: ({ signal }) => {
            const useCase = context.useCases?.analytics?.getGlobalAnalytics;
            if (useCase) {
                return useCase.execute(signal);
            }
            const repo = context.repositories.analytics;
            return repo.getGlobalAnalytics(signal);
        },
    });

    return {
        analytics: data,
        isLoading,
        isError,
        error,
        refetch,
    };
}
