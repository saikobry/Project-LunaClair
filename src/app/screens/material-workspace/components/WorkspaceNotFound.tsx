import { FileQuestion } from 'lucide-react';
import type { AppRoute } from '../../../routing/routing';
import { Button } from '../../../../shared/ui/Button/Button';
import { ErrorState } from '../../../../shared/ui/ErrorState/ErrorState';

export interface WorkspaceNotFoundProps {
  /** Collection the workspace was opened from, when there was one (`?from=`). */
  fromCollectionId?: string;
  onNavigate: (route: AppRoute) => void;
}

/**
 * Missing-material state. Returns to where the user came from: the origin
 * collection when there is one, the library otherwise.
 */
export function WorkspaceNotFound({ fromCollectionId, onNavigate }: WorkspaceNotFoundProps) {
  const exitTarget: AppRoute = fromCollectionId
    ? { kind: 'collection', collectionId: fromCollectionId }
    : { kind: 'library' };
  const label = fromCollectionId ? 'Back to collection' : 'Back to Library';

  return (
    <ErrorState
      icon={<FileQuestion size={28} />}
      title="Material could not be found"
      description="This material does not exist or may have been removed from your library."
      action={
        <Button label={label} variant="primary" onClick={() => onNavigate(exitTarget)}>
          {label}
        </Button>
      }
    />
  );
}
