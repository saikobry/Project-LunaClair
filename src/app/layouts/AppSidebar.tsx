import type { AppRoute } from '../routing/routing';
import type { MaterialWorkspaceTab, NavActiveSection } from './navigation/navigation.types';
import { DesktopSidebar } from './navigation/DesktopSidebar';
import { TabletRail } from './navigation/TabletRail';
import { MobileBottomDock } from './navigation/MobileBottomDock';

export interface AppSidebarProps {
  materialId?: string;
  materialTab?: MaterialWorkspaceTab;
  collectionId?: string;
  active: NavActiveSection;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onNavigate: (route: AppRoute) => void;
}

/**
 * Viewport navigation router: delegates to dedicated DesktopSidebar,
 * TabletRail, and MobileBottomDock slices for completely isolated
 * layout models and tailored Focus Mode physics.
 */
export function AppSidebar({
  collectionId,
  active,
  isFocusMode,
  onToggleFocusMode,
  onNavigate,
}: AppSidebarProps) {
  const sharedProps = {
    active,
    isFocusMode,
    onToggleFocusMode,
    onNavigate,
    collectionId: collectionId ?? null,
  };

  return (
    <>
      {/* Desktop (>= 1024px) */}
      <DesktopSidebar {...sharedProps} />

      {/* Tablet (769px - 1023px) */}
      <TabletRail {...sharedProps} />

      {/* Mobile (<= 768px) */}
      <MobileBottomDock {...sharedProps} />
    </>
  );
}
