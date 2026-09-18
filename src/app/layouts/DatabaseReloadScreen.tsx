import * as stylex from '@stylexjs/stylex';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '../../shared/ui/Button/Button';
import { ErrorState } from '../../shared/ui/ErrorState/ErrorState';
import type { DatabaseReloadReason } from '../../infrastructure/database/schema/databaseLifecycle';
import { databaseReloadScreenStyles as styles } from './databaseReloadScreen.stylex';

/**
 * Copy per reload reason. Each one names the actual cause and what the user must do, because the three
 * cases look identical from the outside (the app is stuck) but have different remedies: wait for
 * nothing (`app-updated` — reloading is enough), expect an empty library (`database-reset`), or close
 * another tab first (`upgrade-blocked`, where reloading alone will not help).
 */
const COPY: Record<DatabaseReloadReason, { title: string; description: string }> = {
  'app-updated': {
    title: 'LunaClair was updated',
    description:
      'Another tab or window upgraded your local database, so this one can no longer use it. Reload to pick up the newer version. Your library and study progress are safe.',
  },
  'database-reset': {
    title: 'This tab lost its local database',
    description:
      'The database was deleted while this tab was open, so reloading starts an empty library. Anything published to the cloud is unaffected and can be cloned again from Explore.',
  },
  'upgrade-blocked': {
    title: 'Close your other LunaClair tabs',
    description:
      'Another LunaClair tab or window is still open with an older version, and it is blocking this one from updating your local database. Close the other tabs, then reload.',
  },
};

interface DatabaseReloadScreenProps {
  reason: DatabaseReloadReason;
  onReload: () => void;
}

/**
 * The screen shown when the tab can no longer use its local database and only a reload can fix it.
 *
 * Rendered by `App.tsx` in place of `AppShell`, so it is the whole app while it is up. It never
 * offers a destructive recovery: there is no "reset" or "clear data" action, because the database is
 * the user's library and the failure is a version mismatch in *this* build, not corrupt data.
 */
export default function DatabaseReloadScreen({ reason, onReload }: DatabaseReloadScreenProps) {
  const { title, description } = COPY[reason];

  return (
    <div {...stylex.props(styles.viewport)}>
      <ErrorState
        icon={<TriangleAlert size={24} />}
        title={title}
        description={description}
        action={
          <Button
            label="Reload LunaClair"
            variant="primary"
            icon={<RefreshCw size={14} />}
            onClick={onReload}
          >
            Reload LunaClair
          </Button>
        }
      />
    </div>
  );
}
