/**
 * Conservative Markdown Normalizer for LunaClair Writer.
 *
 * Normalizes representation differences for dirty-state comparison and fidelity verification:
 * - Standardizes line endings (\r\n -> \n).
 * - Standardizes list bullet markers (* and + -> -) when outside code blocks.
 * - Standardizes table cell padding (| cell | vs |cell|) when outside code blocks.
 * - Trims trailing whitespace on lines and document boundaries.
 * - Standardizes single blank lines between distinct blocks (e.g., headings, lists).
 *
 * Strictly preserves:
 * - Indentation levels (2-space, 4-space, tabs).
 * - Code block contents and inner spacing.
 */
export function normalizeMarkdown(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const normalizedLines: string[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      normalizedLines.push(line.trimEnd());
      continue;
    }

    if (inCodeBlock) {
      // Inside code blocks, whitespace and formatting are preserved verbatim
      normalizedLines.push(line);
      continue;
    }

    let processed = line.trimEnd();

    // Normalize cosmetic escaped quotes and tildes outside code blocks
    processed = processed
      .replace(/\\"/g, '"')
      .replace(/\\~/g, '~')
      .replace(/\\\*/g, '*');

    // Normalize bullet markers (* or + at start of bullet item to -) and canonicalize 2-space step indent
    const bulletMatch = processed.match(/^(\s*)([-*+])\s+(.*)$/);
    if (bulletMatch) {
      const [, indent, , rest] = bulletMatch;
      const spaceCount = indent.replace(/\t/g, '  ').length;
      const normalizedIndent = '  '.repeat(Math.floor(spaceCount / 2));
      processed = `${normalizedIndent}- ${rest}`;
    }

    // Normalize table row pipe formatting if line represents a table row
    if (processed.startsWith('|') && processed.endsWith('|')) {
      const isDivider = /^\|\s*[-:]+[-| :]*\|$/.test(processed);
      if (isDivider) {
        const dividerCols = processed
          .slice(1, -1)
          .split('|')
          .map((col) => {
            const trimmed = col.trim();
            if (trimmed.startsWith(':') && trimmed.endsWith(':')) return ':---:';
            if (trimmed.endsWith(':')) return '---:';
            if (trimmed.startsWith(':')) return ':---';
            return '---';
          });
        processed = `| ${dividerCols.join(' | ')} |`;
      } else {
        const cells = processed
          .slice(1, -1)
          .split('|')
          .map((cell) => cell.trim());
        processed = `| ${cells.join(' | ')} |`;
      }
    }

    normalizedLines.push(processed);

    // Ensure canonical blank line after headings or between block transitions
    const nextLineRaw = i + 1 < lines.length ? lines[i + 1] : '';
    const nextLineTrimmed = nextLineRaw.trim();
    const isHeading = /^#{1,6}\s/.test(processed);
    const isBoldHeader = /^\*\*[^*]+\*\*$/.test(processed);
    const isNextIndentedList = /^\s+(?:[-*+]|\d+\.)\s/.test(nextLineRaw);
    const isNextList = /^(?:[-*+]|\d+\.)\s/.test(nextLineTrimmed);
    const isOrderedItem = /^\s*\d+\.\s/.test(processed);
    const isBulletItem = /^\s*[-*+]\s/.test(processed);
    const isNextIndentedBullet = /^\s+[-*+]\s/.test(nextLineRaw);
    const isNextIndentedOrdered = /^\s+\d+\.\s/.test(nextLineRaw);
    const isCurrentIndentedBullet = /^\s+[-*+]\s/.test(processed);
    const isNextRootOrdered = /^\d+\.\s/.test(nextLineTrimmed);

    const isCurrentList = /^\s*(?:[-*+]|\d+\.)\s/.test(processed);
    const isCurrentTableRow = processed.startsWith('|') && processed.endsWith('|');
    const isCurrentBlockBoundary = isHeading || isBoldHeader || isCurrentList || isCurrentTableRow || processed === '---';
    const isParagraph = !isCurrentBlockBoundary && processed.trim() !== '';

    if (isHeading && nextLineTrimmed !== '') {
      normalizedLines.push('');
    } else if ((isBoldHeader || isParagraph) && (isNextList || isNextIndentedList) && nextLineTrimmed !== '') {
      normalizedLines.push('');
    } else if (isOrderedItem && isNextIndentedBullet) {
      normalizedLines.push('');
    } else if (isBulletItem && isNextIndentedOrdered) {
      normalizedLines.push('');
    } else if (isCurrentIndentedBullet && isNextRootOrdered) {
      normalizedLines.push('');
    }
  }

  // Remove leading/trailing entirely empty lines at document bounds
  while (normalizedLines.length > 0 && normalizedLines[0] === '') {
    normalizedLines.shift();
  }
  while (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1] === '') {
    normalizedLines.pop();
  }

  // Standardize blank lines between blocks outside code blocks
  const resultLines: string[] = [];
  let prevEmpty = false;
  for (let j = 0; j < normalizedLines.length; j++) {
    const line = normalizedLines[j];
    if (line === '') {
      // If blank line sits between an indented sub-bullet and a returning unindented bullet in the same list, skip it
      const prev = j > 0 ? normalizedLines[j - 1] : '';
      const next = j + 1 < normalizedLines.length ? normalizedLines[j + 1] : '';
      const isPrevSubBullet = /^\s+[-*+]\s/.test(prev);
      const isNextRootBullet = /^[-*+]\s/.test(next);
      if (isPrevSubBullet && isNextRootBullet) {
        continue;
      }

      if (!prevEmpty) {
        resultLines.push('');
        prevEmpty = true;
      }
    } else {
      resultLines.push(line);
      prevEmpty = false;
    }
  }

  return resultLines.join('\n');
}
