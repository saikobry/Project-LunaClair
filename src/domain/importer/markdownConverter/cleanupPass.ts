/**
 * Final cleanup pass for markdown formatting.
 */
export function runCleanupPass(text: string): string {
  // Trim trailing whitespace from every line
  let lines = text.split('\n').map(line => line.trimEnd());

  // Ensure horizontal rules have blank lines before and after
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '---') {
      if (i > 0 && lines[i - 1] !== '') {
        lines.splice(i, 0, '');
        i++;
      }
      if (i < lines.length - 1 && lines[i + 1] !== '') {
        lines.splice(i + 1, 0, '');
      }
    }
  }

  let cleaned = lines.join('\n');

  // Collapse 3+ consecutive blank lines to exactly 2
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');

  // Remove orphan horizontal rules at start/end of document
  cleaned = cleaned.replace(/^\s*---\s*\n+/, '');
  cleaned = cleaned.replace(/\n+\s*---\s*$/, '');

  // Ensure file ends with exactly one newline
  cleaned = cleaned.trimEnd() + '\n';

  return cleaned;
}
