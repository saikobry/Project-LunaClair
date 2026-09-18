import AppShell from './app/layouts/AppShell';
import DatabaseReloadScreen from './app/layouts/DatabaseReloadScreen';
import { AppProviders } from './app/providers/AppProviders';
import { useAppBootstrap } from './app/useAppBootstrap';

/**
 * Root component.
 *
 * Three states, and the last two are why this is no longer a bare `ready` flag:
 * - `loading` → nothing (the shell is not mounted until the database is open);
 * - reload required → `DatabaseReloadScreen` *instead of* the shell, wrapped in `AppProviders` so it
 *   still renders with the Astryx theme — the case where a stale bundle meets a newer database and
 *   the only recovery is a reload;
 * - `ready` → the shell.
 *
 * `AppProviders` is mounted only in the two terminal branches, so the dependency graph is not built
 * before the database opens.
 */
export default function App() {
  const { status, reloadReason, requestReload } = useAppBootstrap();

  if (reloadReason) {
    return (
      <AppProviders>
        <DatabaseReloadScreen reason={reloadReason} onReload={requestReload} />
      </AppProviders>
    );
  }

  if (status !== 'ready') {
    return null;
  }

  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}
