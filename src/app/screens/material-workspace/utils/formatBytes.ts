/**
 * Human file-size formatting for the workspace attachments surface
 * (`1023 B` stays in bytes, kilobytes round to whole units, megabytes keep
 * one decimal). Pure display helper — byte-exact values stay in
 * `StoredAsset.blob.size`.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
