/**
 * Formats an ISO-8601 UTC timestamp into a human-readable relative sync time.
 */
export function formatSyncTime(isoString?: string): string {
  if (!isoString) {
    return 'Not synced yet';
  }

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (Number.isNaN(diffMs)) {
    return 'Not synced yet';
  }

  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 10) {
    return 'Synced just now';
  }
  if (diffSec < 60) {
    return 'Synced seconds ago';
  }
  if (diffSec < 120) {
    return 'Synced 1m ago';
  }
  if (diffSec < 3600) {
    return `Synced ${Math.floor(diffSec / 60)}m ago`;
  }
  if (diffSec < 86400) {
    return `Synced ${Math.floor(diffSec / 3600)}h ago`;
  }

  return `Synced on ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}
