import type { AppRoute } from '../routing/routing';
import { useSubject } from '../../features/catalog/subjects/hooks/queries/useSubject';
import { useMaterial } from '../../features/catalog/materials/hooks/queries/useMaterial';
import type { NavActiveSection } from './navigation/navigation.types';
import { DesktopSidebar } from './navigation/DesktopSidebar';
import { TabletRail } from './navigation/TabletRail';
import { MobileBottomDock } from './navigation/MobileBottomDock';

export interface AppSidebarProps {
  subjectId?: string;
  materialId?: string;
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
  subjectId,
  materialId,
  active,
  isFocusMode,
  onToggleFocusMode,
  onNavigate,
}: AppSidebarProps) {
  const { subject } = useSubject(subjectId);
  const { material } = useMaterial(materialId);

  const sharedProps = {
    active,
    isFocusMode,
    onToggleFocusMode,
    onNavigate,
    subject,
    material,
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
