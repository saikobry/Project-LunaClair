/**
 * Formats an ISO date string into a compact, human-readable relative time string.
 *
 * Rules:
 * - Empty, null, undefined, or invalid timestamps return 'Never opened'
 * - Future timestamps (< 0ms diff) or under 1 hour diff return 'Just now'
 * - Under 24 hours diff return '<N>h ago'
 * - Under 7 days diff return '<N>d ago'
 * - Older timestamps format as localized 'MMM D' (e.g. 'Jan 15')
 */
export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return 'Never opened';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Never opened';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'Just now';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
