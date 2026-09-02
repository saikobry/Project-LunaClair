import { useQuery } from '@tanstack/react-query';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import { useContextOrThrow } from '../../../../shared/utils/contextGuard';
import type { ListPublicSharesParams } from '../../../../domain/sharing/models/sharing.types';

export function usePublicShares(params: ListPublicSharesParams = {}) {
  const context = useContextOrThrow(ApplicationContext, 'usePublicShares');

  return useQuery({
    queryKey: ['public-shares', params.q, params.sort, params.limit, params.cursor],
    queryFn: ({ signal }) => context.useCases.sharing.listPublicShares.execute(params, signal),
    staleTime: 30_000,
  });
}
