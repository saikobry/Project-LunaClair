import type { LucideIcon } from 'lucide-react';
import { Home, Compass, FileUp, TrendingUp } from 'lucide-react';
import type { AppRoute } from '../../routing/routing';
import type { NavActiveSection } from './navigation.types';

export interface PrimaryNavItem {
  id: 'library' | 'explore' | 'import' | 'analytics';
  /** Visible label for desktop sidebar. */
  label: string;
  /** Tooltip / accessible name. */
  title: string;
  icon: LucideIcon;
  route: AppRoute;
  isActive: (active: NavActiveSection) => boolean;
}

/** The four static destinations shared by every viewport navigation variant. */
export const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  {
    id: 'library',
    label: 'Library',
    title: 'Library',
    icon: Home,
    route: { kind: 'library' },
    isActive: (active) => active === 'library',
  },
  {
    id: 'explore',
    label: 'Explore',
    title: 'Explore Content',
    icon: Compass,
    route: { kind: 'explore' },
    isActive: (active) => active === 'explore' || active === 'available',
  },
  {
    id: 'import',
    label: 'Import',
    title: 'Import Content',
    icon: FileUp,
    route: { kind: 'import' },
    isActive: (active) => active === 'import',
  },
  {
    id: 'analytics',
    label: 'Insights',
    title: 'Learning Insights & Analytics',
    icon: TrendingUp,
    route: { kind: 'analytics' },
    isActive: (active) => active === 'analytics',
  },
];
