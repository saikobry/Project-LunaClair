export type DiffLineType = 'equal' | 'delete' | 'add';

export interface DiffLine {
  id?: string;
  type: DiffLineType;
  text: string;
  originalLineNumber?: number;
  cleanedLineNumber?: number;
}

export interface SplitDiffSide {
  lineNumber: number;
  text: string;
  type: DiffLineType;
}

export interface SplitDiffRow {
  id: string;
  original?: SplitDiffSide;
  cleaned?: SplitDiffSide;
}

export interface DiffSummary {
  additions: number;
  deletions: number;
  unifiedLines: DiffLine[];
  splitRows: SplitDiffRow[];
}

/**
 * Computes a line-by-line diff between original extracted text and AI-cleaned markdown.
 * Uses prefix/suffix trimming and Longest Common Subsequence (LCS) to generate
 * unified lines and side-by-side rows for Git-style diff viewing.
 */
export function computeLineDiff(original: string, cleaned: string): DiffSummary {
  const origLines = original ? original.split('\n') : [];
  const cleanLines = cleaned ? cleaned.split('\n') : [];
  const n = origLines.length;
  const m = cleanLines.length;

  if (n === 0 && m === 0) {
    return { additions: 0, deletions: 0, unifiedLines: [], splitRows: [] };
  }

  // 1. Common prefix trimming
  let start = 0;
  while (start < n && start < m && origLines[start] === cleanLines[start]) {
    start++;
  }

  // 2. Common suffix trimming
  let origEnd = n - 1;
  let cleanEnd = m - 1;
  while (origEnd >= start && cleanEnd >= start && origLines[origEnd] === cleanLines[cleanEnd]) {
    origEnd--;
    cleanEnd--;
  }

  const trimmedOrig = origLines.slice(start, origEnd + 1);
  const trimmedClean = cleanLines.slice(start, cleanEnd + 1);
  const tn = trimmedOrig.length;
  const tm = trimmedClean.length;

  // 3. Diff for trimmed core
  const middleUnified: DiffLine[] = [];
  if (tn > 0 && tm === 0) {
    for (const text of trimmedOrig) {
      middleUnified.push({ type: 'delete', text });
    }
  } else if (tn === 0 && tm > 0) {
    for (const text of trimmedClean) {
      middleUnified.push({ type: 'add', text });
    }
  } else if (tn > 0 && tm > 0) {
    // If matrix is extremely large (> 1M cells), fallback to append/delete
    if (tn * tm > 1_000_000) {
      for (const text of trimmedOrig) {
        middleUnified.push({ type: 'delete', text });
      }
      for (const text of trimmedClean) {
        middleUnified.push({ type: 'add', text });
      }
    } else {
      const dp: number[][] = Array.from({ length: tn + 1 }, () => new Array(tm + 1).fill(0));
      for (let i = 1; i <= tn; i++) {
        for (let j = 1; j <= tm; j++) {
          if (trimmedOrig[i - 1] === trimmedClean[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1] + 1;
          } else {
            dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
          }
        }
      }

      let i = tn;
      let j = tm;
      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && trimmedOrig[i - 1] === trimmedClean[j - 1]) {
          middleUnified.unshift({ type: 'equal', text: trimmedOrig[i - 1] });
          i--;
          j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
          middleUnified.unshift({ type: 'add', text: trimmedClean[j - 1] });
          j--;
        } else if (i > 0) {
          middleUnified.unshift({ type: 'delete', text: trimmedOrig[i - 1] });
          i--;
        }
      }
    }
  }

  // 4. Assemble full unified lines with line numbers
  const unifiedLines: DiffLine[] = [];
  let origLineNum = 1;
  let cleanLineNum = 1;

  for (let k = 0; k < start; k++) {
    unifiedLines.push({
      type: 'equal',
      text: origLines[k],
      originalLineNumber: origLineNum++,
      cleanedLineNumber: cleanLineNum++,
    });
  }

  for (const item of middleUnified) {
    if (item.type === 'equal') {
      unifiedLines.push({
        ...item,
        originalLineNumber: origLineNum++,
        cleanedLineNumber: cleanLineNum++,
      });
    } else if (item.type === 'delete') {
      unifiedLines.push({
        ...item,
        originalLineNumber: origLineNum++,
      });
    } else {
      unifiedLines.push({
        ...item,
        cleanedLineNumber: cleanLineNum++,
      });
    }
  }

  for (let k = origEnd + 1; k < n; k++) {
    unifiedLines.push({
      type: 'equal',
      text: origLines[k],
      originalLineNumber: origLineNum++,
      cleanedLineNumber: cleanLineNum++,
    });
  }

  let additions = 0;
  let deletions = 0;
  for (let i = 0; i < unifiedLines.length; i++) {
    const line = unifiedLines[i];
    line.id = `u-${i + 1}`;
    if (line.type === 'add') additions++;
    else if (line.type === 'delete') deletions++;
  }

  // 5. Construct split side-by-side rows
  const splitRows: SplitDiffRow[] = [];
  let splitCounter = 0;
  let idx = 0;
  while (idx < unifiedLines.length) {
    const cur = unifiedLines[idx];
    if (cur.type === 'equal') {
      splitRows.push({
        id: `split-${++splitCounter}`,
        original: { lineNumber: cur.originalLineNumber!, text: cur.text, type: 'equal' },
        cleaned: { lineNumber: cur.cleanedLineNumber!, text: cur.text, type: 'equal' },
      });
      idx++;
    } else {
      const deletes: DiffLine[] = [];
      const adds: DiffLine[] = [];
      while (idx < unifiedLines.length && unifiedLines[idx].type === 'delete') {
        deletes.push(unifiedLines[idx]);
        idx++;
      }
      while (idx < unifiedLines.length && unifiedLines[idx].type === 'add') {
        adds.push(unifiedLines[idx]);
        idx++;
      }
      const maxLen = Math.max(deletes.length, adds.length);
      for (let r = 0; r < maxLen; r++) {
        const d = deletes[r];
        const a = adds[r];
        splitRows.push({
          id: `split-${++splitCounter}`,
          original: d ? { lineNumber: d.originalLineNumber!, text: d.text, type: 'delete' } : undefined,
          cleaned: a ? { lineNumber: a.cleanedLineNumber!, text: a.text, type: 'add' } : undefined,
        });
      }
    }
  }

  return {
    additions,
    deletions,
    unifiedLines,
    splitRows,
  };
}
