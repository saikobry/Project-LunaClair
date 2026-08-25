/**
 * Detects tabular structures and converts them to GFM tables.
 */
export function runTablePass(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  
  let tableBlock: string[] = [];

  const flushTableBlock = () => {
    if (tableBlock.length === 0) return;

    if (tableBlock.length >= 3) {
      // Basic table conversion
      const parsedRows = tableBlock.map(row => {
        // Split by 2+ spaces OR by ': ' for key-value pairs
        if (/\s{2,}/.test(row)) {
          return row.trim().split(/\s{2,}/);
        } else if (row.includes(': ')) {
          const parts = row.split(': ');
          return [parts[0].trim(), parts.slice(1).join(': ').trim()];
        }
        return [row.trim()];
      });

      // Check if they all have similar number of columns (at least 2)
      const colCounts = parsedRows.map(r => r.length);
      const minCols = Math.min(...colCounts);
      const maxCols = Math.max(...colCounts);

      if (minCols >= 2 && maxCols - minCols <= 1) {
        // Convert to Markdown table
        const numCols = maxCols;
        for (let i = 0; i < parsedRows.length; i++) {
          const row = parsedRows[i];
          while (row.length < numCols) {
            row.push('');
          }
          result.push(`| ${row.join(' | ')} |`);
          if (i === 0) {
            // Header separator
            result.push(`|${Array(numCols).fill('---').join('|')}|`);
          }
        }
      } else {
        result.push(...tableBlock);
      }
    } else {
      result.push(...tableBlock);
    }
    tableBlock = [];
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushTableBlock();
      result.push(line);
      continue;
    }

    // Heuristic: lines with 2 or more spaces in a row or containing ': ' are potential table rows
    if (/\s{2,}/.test(line.trim()) || line.includes(': ')) {
      tableBlock.push(line);
    } else {
      flushTableBlock();
      result.push(line);
    }
  }

  flushTableBlock();

  return result.join('\n');
}
