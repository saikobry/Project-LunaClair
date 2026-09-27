import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApplicationContext, type ApplicationContextValue } from './ApplicationContext';
import { createApplication } from '../bootstrap/createApplication';
import { ANALYTICS_QUERY_KEY } from '../bootstrap/analyticsInvalidation';

interface ApplicationProviderProps {
  children: ReactNode;
}

/**
 * Provides all domain repositories, infrastructure services, and application
 * use cases to feature hooks via React context. Instances are stable singletons
 * that never recreate across re-renders.
 *
 * This is also where the composition root's analytics cache hook is bound to
 * the real `QueryClient`. The graph is assembled inside the
 * `<QueryClientProvider>` (see `AppProviders`), so the one application object
 * carries an invalidator that question writes and deletes can reach without
 * any feature importing the analytics feature.
 */
export function ApplicationProvider({ children }: ApplicationProviderProps) {
  const queryClient = useQueryClient();
  const [value] = useState<ApplicationContextValue>(() =>
    createApplication(() => {
      void queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY });
    }),
  );

  return (
    <ApplicationContext.Provider value={value}>
      {children}
    </ApplicationContext.Provider>
  );
}
