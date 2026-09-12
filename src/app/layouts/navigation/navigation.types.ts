import type { AppRoute } from '../../routing/routing';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';

export type NavActiveSection =
  | 'library'
  | 'explore'
  | 'available'
  | 'import'
  | 'analytics'
  | 'unfiled'
  | 'none';

/** Workspace tabs a material can be open on (`/materials/:id?tab=...`). */
export type MaterialWorkspaceTab = 'read' | 'write' | 'quiz' | 'flashcards' | 'manage';

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
