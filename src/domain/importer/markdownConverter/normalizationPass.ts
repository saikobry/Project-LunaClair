/**
 * Normalizes text extracted from documents.
 */
export function runNormalizationPass(text: string): string {
  // Replace Windows line endings
  let normalized = text.replace(/\r\n/g, '\n');

  // Normalize Unicode whitespace (non-breaking spaces, zero-width chars)
  normalized = normalized.replace(/[\u00A0\u200B\u200C\u2060\uFEFF]/g, ' ');
  normalized = normalized.replace(/\u200D/g, ' ');

  // Remove page-break artifacts (form feed \f)
  normalized = normalized.replace(/\f/g, '\n');

  // Trim trailing whitespace per line
  normalized = normalized
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');

  // Collapse runs of 3+ blank lines to 2
  normalized = normalized.replace(/\n{4,}/g, '\n\n\n');

  return normalized;
}
