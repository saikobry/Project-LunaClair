import type { AppRoute } from '../../routing/routing';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';

export type NavActiveSection =
  | 'library'
  | 'explore'
  | 'available'
  | 'import'
  | 'analytics'
  | 'none';

export interface ViewportNavProps {
  active: NavActiveSection;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onNavigate: (route: AppRoute) => void;
  material?: StudyMaterial | null;
  /** Active collection id for the sidebar Collections section (`/collections/:collectionId` route). */
  collectionId?: string | null;
}
