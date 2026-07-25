import { type ReactNode } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { lunaclairTheme } from '../../shared/theme/lunaclairTheme';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Application-level providers.
 *
 * Encapsulates third-party context providers so `main.tsx` stays lean
 * and feature code never imports third-party providers directly.
 *
 * Current providers:
 * - Astryx `<Theme>` with the LunaClair custom theme (light mode)
 *
 * Future (Phase 2+): TanStack Query, toast, auth, etc.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <Theme theme={lunaclairTheme} mode="light">
      {children}
    </Theme>
  );
}
