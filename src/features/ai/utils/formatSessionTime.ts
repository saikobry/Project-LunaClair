/**
 * Formats an ISO-8601 UTC timestamp into a compact relative label for the
 * AI session history list.
 *
 * `now` is injectable so the ladder is deterministic under test.
 */
export function formatSessionTime(isoString: string, now: Date = new Date()): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSec < 60) {
    return 'Just now';
  }
  if (diffSec < 3600) {
    return `${Math.floor(diffSec / 60)}m ago`;
  }
  if (diffSec < 86400) {
    return `${Math.floor(diffSec / 3600)}h ago`;
  }
  if (diffSec < 604800) {
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
