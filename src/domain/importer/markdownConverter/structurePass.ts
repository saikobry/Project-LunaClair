/**
 * Detects structural elements like headings in raw text.
 */
export function runStructurePass(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      result.push(line);
      continue;
    }

    // Detect ALL CAPS lines (>=3 words, >=10 chars)
    if (trimmed === trimmed.toUpperCase() && trimmed.length >= 10 && trimmed.split(/\s+/).length >= 3) {
      // Exclude lines with many numbers or symbols which might not be headings
      if (!/^[0-9\W]+$/.test(trimmed)) {
        result.push(`## ${trimmed}`);
        continue;
      }
    }

    // Detect numbered section patterns like '1.', '1.1', 'Chapter 1', 'Section 1'
    if (/^(\d+\.|\d+\.\d+|Chapter\s+\d+|Section\s+\d+)\s+[A-Z]/.test(trimmed)) {
      result.push(`## ${trimmed}`);
      continue;
    }

    // Detect bold-like patterns (short stand-alone lines)
    // Needs empty line before and after, shorter than 60 chars
    const prevLine = i > 0 ? lines[i - 1].trim() : '';
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

    if (trimmed.length > 0 && trimmed.length < 60 && !prevLine && !nextLine && !trimmed.endsWith('.')) {
      // It's a short stand-alone line, likely a heading
      // Only if it doesn't look like a list item or table row
      if (!/^[-*•\d]/.test(trimmed) && !trimmed.includes('  ')) {
        result.push(`### ${trimmed}`);
        continue;
      }
    }

    result.push(line);
  }

  return result.join('\n');
}
