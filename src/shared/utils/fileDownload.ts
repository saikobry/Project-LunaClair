/**
 * Sanitizes a string for safe use as a filename across Windows, macOS, and Linux.
 * Replaces invalid filesystem characters (<>:"/\\|?*), strips control characters,
 * trims leading/trailing spaces and dots, and returns a safe fallback if empty.
 */
export function sanitizeFilename(name: string, fallback = 'study-package'): string {
  if (!name || typeof name !== 'string') {
    return fallback;
  }

  // Replace invalid filesystem chars (<>:"/\|?*) and control chars (ASCII 0-31, 127-159) with '_'
  const invalidChars = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);
  let sanitized = '';
  for (let i = 0; i < name.length; i++) {
    const char = name[i];
    const code = char.charCodeAt(0);
    if (invalidChars.has(char) || (code >= 0 && code <= 31) || (code >= 127 && code <= 159)) {
      sanitized += '_';
    } else {
      sanitized += char;
    }
  }

  sanitized = sanitized.trim().replace(/[. ]+$/, '');

  return sanitized.length > 0 ? sanitized : fallback;
}

/**
 * Triggers a browser download of a Blob by creating an object URL,
 * appending an invisible anchor element, invoking click(), and revoking the URL.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
