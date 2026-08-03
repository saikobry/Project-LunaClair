import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@astryxdesign/core/theme';
import { lunaclairTheme } from '../../shared/theme/lunaclairTheme';
import { ApplicationProvider } from './ApplicationProvider';
import { ToastProvider } from './ToastContext';

interface AppProvidersProps {
  children: ReactNode;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60,       // 1 minute
      gcTime: 1000 * 60 * 10,     // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Application-level providers.
 *
 * Encapsulates third-party context providers so `main.tsx` stays lean
 * and feature code never imports third-party providers directly.
 *
 * Current providers:
 * - TanStack Query `<QueryClientProvider>` with centralized query defaults
 * - `<ApplicationProvider>` supplying dependency-injected storage repositories and application services
 * - Astryx `<Theme>` with the LunaClair custom theme (light mode)
 * - `<ToastProvider>` for user action feedback notifications
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApplicationProvider>
        <Theme theme={lunaclairTheme} mode="light">
          <ToastProvider>
            {children}
          </ToastProvider>
        </Theme>
      </ApplicationProvider>
    </QueryClientProvider>
  );
}
