/**
 * Detects and formats lists in raw text.
 */
export function runListPass(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      result.push(line);
      continue;
    }

    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    const trimmed = line.trim();

    // Preserve existing markdown lists
    if (/^([-*+])\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      result.push(line);
      continue;
    }

    // Detect bullet patterns
    if (/^[•·►▪]\s*/.test(trimmed)) {
      const rest = trimmed.replace(/^[•·►▪]\s*/, '');
      result.push(`${indent}- ${rest}`);
      continue;
    }

    // Detect numbered patterns: '1)', 'a)', 'i.', '(1)', '(a)'
    // Wait, 'a)' might be tricky, let's keep it somewhat strict.
    // '1)', 'a)', '(1)', '(a)', 'i.', 'I.'
    const numMatch = trimmed.match(/^(\d+\)|[a-zA-Z]\)|\(\d+\)|\([a-zA-Z]\)|[ivxlcdmIVXLCDM]+\.)\s+(.+)/);
    if (numMatch) {
      // Just convert to standard markdown numbered list (1. item)
      result.push(`${indent}1. ${numMatch[2]}`);
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}
