import type { LucideIcon } from 'lucide-react';
import { Home, LibraryBig, Compass, TrendingUp } from 'lucide-react';
import type { AppRoute } from '../../routing/routing';
import type { NavActiveSection } from './navigation.types';

export interface PrimaryNavItem {
  id: 'home' | 'library' | 'explore' | 'analytics';
  /** Visible label for desktop sidebar. */
  label: string;
  /** Tooltip / accessible name. */
  title: string;
  icon: LucideIcon;
  route: AppRoute;
  isActive: (active: NavActiveSection) => boolean;
}

/**
 * The static destinations shared by every viewport navigation variant.
 *
 * `Home` is the dashboard ("what should I do next?"); `Library` owns collections
 * and materials ("what do I have?"), including the `uncollected` membership
 * lens for materials in no collection. Import is not a destination either: it
 * is reached from Home's quick actions, so it does not occupy a nav slot.
 */
export const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  {
    id: 'home',
    label: 'Home',
    title: 'Home',
    icon: Home,
    route: { kind: 'home' },
    isActive: (active) => active === 'home',
  },
  {
    id: 'library',
    label: 'Library',
    title: 'Library — Collections & Materials',
    icon: LibraryBig,
    route: { kind: 'library' },
    isActive: (active) => active === 'library',
  },
  {
    id: 'explore',
    label: 'Explore',
    title: 'Explore Content',
    icon: Compass,
    route: { kind: 'explore' },
    isActive: (active) => active === 'explore',
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
