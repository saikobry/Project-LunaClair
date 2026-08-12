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
      // Offline-first: the app's data layer is local (IndexedDB) and its
      // documents are served by the service worker's cache, so queries must
      // run — not pause — when `navigator.onLine` is false. TanStack's
      // default `networkMode: 'online'` freezes not-yet-cached queries
      // offline (a fresh material lookup would show "Material not found").
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Mutations are local Dexie writes too — TanStack's default 'online'
      // mode defers them (in-memory) until reconnect, which would drop
      // changes if the tab closes while offline and contradict the offline
      // banner's "changes are saved locally" promise.
      networkMode: 'offlineFirst',
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
