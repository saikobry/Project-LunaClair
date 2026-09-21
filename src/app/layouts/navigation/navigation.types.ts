import type { AppRoute, MaterialWorkspaceTab } from '../../routing/routing';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';

/** Workspace tabs a material can be open on (`/materials/:id?tab=...`). Canonical union lives in `routing.ts`; re-exported here for nav consumers. */
export type { MaterialWorkspaceTab };

export type NavActiveSection =
  | 'home'
  | 'library'
  | 'explore'
  | 'import'
  | 'analytics'
  | 'settings'
  | 'none';

export interface ViewportNavProps {
  active: NavActiveSection;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onNavigate: (route: AppRoute) => void;
  material?: StudyMaterial | null;
  /** Active collection id for the Collections affordances (`/collections/:collectionId` route). */
  collectionId?: string | null;
  /**
   * Tab the active material is currently open on. The active-material entry must
   * preserve this tab when it navigates (no forced back-to-Read bounce); derived
   * from the route by the shell (`undefined` on non-material routes).
   */
  materialTab?: MaterialWorkspaceTab;
}
