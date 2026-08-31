import type { AppRoute } from '../../routing/routing';
import type { Subject } from '../../../domain/library/Subject';
import type { StudyMaterial } from '../../../domain/library/StudyMaterial';

export type NavActiveSection =
  | 'library'
  | 'explore'
  | 'available'
  | 'import'
  | 'analytics'
  | 'terms'
  | 'none';

export interface ViewportNavProps {
  active: NavActiveSection;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onNavigate: (route: AppRoute) => void;
  subject?: Subject | null;
  material?: StudyMaterial | null;
}
