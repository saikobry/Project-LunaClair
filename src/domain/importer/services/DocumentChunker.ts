/**
 * Splits a long Markdown document into model-sized chunks for AI cleanup.
 *
 * **Why a chunker exists at all.** AI cleanup rewrites a document, so its *output* is roughly the
 * size of its *input*. Both models the app offers reserve 4,096 output tokens (~12k characters of
 * Markdown at the project's own 3 chars/token estimate), so a document larger than that cannot
 * round-trip in one request however large the model's window is — MAX's 256k window buys input
 * headroom that cleanup cannot use. Slicing the document is the only way to clean a long one.
 *
 * **This module is pure.** No React, no DOM, no network, no model facts: the caller
 * (`CleanupImportWithAiUseCase`) owns pacing, retries, and prompt construction, and passes the two
 * character budgets in. That keeps "where may I cut this text?" a question testable on its own.
 *
 * **Cuts land only between blocks.** The document is described as a run of contiguous blocks —
 * paragraphs, headings, rules, and code/table/quote runs — and a boundary may only fall on a block
 * edge. A fenced code block, a table, and a blockquote run are each a single atomic block that is
 * never cut, even when it alone exceeds the target: an oversized chunk is something the model can
 * still be asked to clean, whereas half a table is not. Only a text run (the spec's paragraph
 * fallback) may be cut at its own line breaks.
 */

export interface DocumentChunk {
  /** Zero-based position of this chunk in the sequence. */
  index: number;
  /** Total chunks in the sequence; always at least 1. */
  total: number;
  content: string;
  /** The nearest heading at or above the chunk's first line, when the document has one. */
  heading?: string;
  /** Half-open character range `[start, end)` this chunk occupies in the source document. */
  charRange: [start: number, end: number];
}

export interface ChunkingOptions {
  /**
   * Target characters per chunk. The default is calibrated against the 4,096 output-token
   * reservation at the project's markdown estimate (3 chars/token → ~12k), leaving the model room
   * to expand formatting without reaching the ceiling.
   */
  targetChunkChars?: number;
  /** Documents at or below this length are sent whole, as a single chunk. */
  fastPathThreshold?: number;
}

/** Default chunk size — safe for a 4,096 output-token reservation. */
export const DEFAULT_TARGET_CHUNK_CHARS = 8_000;

/**
 * Documents at or below this length bypass chunking entirely.
 *
 * Deliberately above `DEFAULT_TARGET_CHUNK_CHARS`: a document between the two would otherwise split
 * into a full chunk plus a small remainder — two slow, rate-limited requests to save nothing. The
 * use case and this module both read the value from here, so the single-request and chunked paths
 * cannot disagree about where the boundary is.
 */
export const DEFAULT_FAST_PATH_THRESHOLD = 9_000;

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;
const TABLE_ROW = /^ {0,3}\|/;
const BLOCKQUOTE = /^ {0,3}>/;
const HEADING = /^ {0,3}(#{1,6})\s+(\S.*)$/;
const HORIZONTAL_RULE = /^ {0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/;
const HEADING_LINE = /^ {0,3}#{1,6}\s+\S/;

/** The block flavours a boundary decision cares about. */
type BlockKind = 'text' | 'heading' | 'rule' | 'table' | 'quote' | 'fence';

interface Block {
  /** Offset of the block's first character in the document. */
  start: number;
  /** Offset one past the block's last character. */
  end: number;
  kind: BlockKind;
}

interface ScanResult {
  /** Contiguous, ordered, first block always starting at 0. */
  blocks: Block[];
  /** Every heading line in the document, in order of appearance. */
  headings: { offset: number; text: string }[];
}

/**
 * Describes the document as contiguous blocks in a single pass.
 *
 * A block ends where the next one begins, so the blocks partition the document exactly and their
 * concatenated slices reproduce it byte for byte. Because only block *edges* are ever candidate
 * boundaries, a fence, a table, or a blockquote run can never be opened in one chunk and closed in
 * another.
 */
function scanDocument(markdown: string): ScanResult {
  const starts: { offset: number; kind: BlockKind }[] = [];
  const headings: { offset: number; text: string }[] = [];

  let offset = 0;
  let fence: { char: string; length: number } | null = null;
  let prevBlank = true;
  let prevKind: BlockKind | 'none' = 'none';

  const mark = (lineStart: number, kind: BlockKind) => {
    const last = starts[starts.length - 1];
    if (!last || last.offset !== lineStart) starts.push({ offset: lineStart, kind });
  };

  while (offset < markdown.length) {
    const newlineAt = markdown.indexOf('\n', offset);
    const lineStop = newlineAt === -1 ? markdown.length : newlineAt;
    const line = markdown.slice(offset, lineStop);
    const lineStart = offset;
    offset = newlineAt === -1 ? markdown.length : newlineAt + 1;

    if (fence) {
      const close = FENCE_CLOSE.exec(line);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
        fence = null;
        prevKind = 'text';
        prevBlank = false;
      }
      // Inside a fence nothing is a boundary — not the content, not the closing line.
      continue;
    }

    const fenceOpen = FENCE_OPEN.exec(line);
    if (fenceOpen) {
      mark(lineStart, 'fence');
      fence = { char: fenceOpen[1][0], length: fenceOpen[1].length };
      prevKind = 'fence';
      prevBlank = false;
      continue;
    }

    if (TABLE_ROW.test(line)) {
      if (prevKind !== 'table') mark(lineStart, 'table');
      prevKind = 'table';
      prevBlank = false;
      continue;
    }

    if (BLOCKQUOTE.test(line)) {
      if (prevKind !== 'quote') mark(lineStart, 'quote');
      prevKind = 'quote';
      prevBlank = false;
      continue;
    }

    if (line.trim() === '') {
      // A blank line ends a paragraph (a seam) but belongs to neither side.
      prevBlank = true;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      mark(lineStart, 'heading');
      headings.push({ offset: lineStart, text: heading[2].trim() });
      prevKind = 'heading';
      prevBlank = false;
      continue;
    }

    if (HORIZONTAL_RULE.test(line)) {
      // A rule directly under a line of text is a setext-heading underline, not a separator —
      // cutting between the two would break the heading in half.
      if (prevKind === 'text' && !prevBlank) {
        prevKind = 'text';
        prevBlank = false;
        continue;
      }
      mark(lineStart, 'rule');
      prevKind = 'rule';
      prevBlank = false;
      continue;
    }

    if (prevBlank || prevKind !== 'text') mark(lineStart, 'text');
    prevKind = 'text';
    prevBlank = false;
  }

  const blocks: Block[] = starts.map((start, index) => ({
    start: start.offset,
    end: index + 1 < starts.length ? starts[index + 1].offset : markdown.length,
    kind: start.kind,
  }));

  return { blocks, headings };
}

/** Heading text of the deepest heading at or above `offset`, or `undefined` before the first one. */
function headingAt(
  headings: { offset: number; text: string }[],
  offset: number,
): string | undefined {
  let resolved: string | undefined;
  for (const heading of headings) {
    if (heading.offset > offset) break;
    resolved = heading.text;
  }
  return resolved;
}

/** True when a block is a heading with nothing under it (`## References` before the next heading). */
function isHeadingOnly(blocks: Block[], index: number): boolean {
  const block = blocks[index];
  if (block.kind !== 'heading') return false;
  const next = blocks[index + 1];
  return !next || next.kind === 'heading' || next.kind === 'rule';
}

/**
 * Finds the cut index closest to `idealCut` among all matches of `regex` whose derived cut
 * position falls within `[minCut, maxCut]`.
 */
function findBestCut(
  markdown: string,
  regex: RegExp,
  getCut: (match: RegExpExecArray) => number,
  minCut: number,
  maxCut: number,
  idealCut: number,
): number | null {
  const searchStart = Math.max(0, minCut - 100);
  regex.lastIndex = searchStart;
  let bestCut: number | null = null;
  let bestDistance = Infinity;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    if (match.index > maxCut + 100) break;
    const cut = getCut(match);
    if (cut >= minCut && cut <= maxCut) {
      const distance = Math.abs(cut - idealCut);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCut = cut;
      }
    }
    if (match.index === regex.lastIndex) {
      regex.lastIndex += 1;
    }
  }
  return bestCut;
}

/**
 * Cuts one over-sized span using hierarchical boundary search within an elastic target window
 * (target -20% / +25%: min 0.80 * target, max 1.25 * target).
 *
 * Boundary search priority:
 * 1. Paragraph boundary: double newline `\n\s*\n`
 * 2. List item boundary: newline followed by a list marker: `\n[ \t]*(?:\d+\.|\*|-|[a-zA-Z]\.)\s+`
 * 3. Sentence boundary: punctuation followed by whitespace: `(?<=[.!?])\s+`
 * 4. Fallback: single newline `\n`, then whitespace `\s+`
 * 5. Absolute fallback: hard cut at target if no whitespace or punctuation exists
 *
 * Ensures cuts never land mid-sentence or mid-list-item when a paragraph or sentence break exists in
 * the search window.
 */
export function splitTextRun(
  markdown: string,
  start: number,
  end: number,
  target: number,
): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  let cursor = start;

  while (end - cursor > target) {
    const idealCut = cursor + target;
    const minCut = Math.max(cursor + 1, cursor + Math.floor(target * 0.80));
    const maxCut = Math.min(end, Math.max(minCut, cursor + Math.ceil(target * 1.25)));

    let cut: number | null = null;

    // 1. Paragraph boundary: double newline
    cut = findBestCut(markdown, /\n\s*\n/g, (m) => m.index + m[0].length, minCut, maxCut, idealCut);

    // 2. List item boundary: newline followed by a list marker
    if (cut === null) {
      cut = findBestCut(
        markdown,
        /\n[ \t]*(?:\d+\.|\*|-|[a-zA-Z]\.)\s+/g,
        (m) => m.index + 1,
        minCut,
        maxCut,
        idealCut,
      );
    }

    // 3. Sentence boundary: punctuation followed by whitespace
    if (cut === null) {
      cut = findBestCut(
        markdown,
        /(?<=[.!?])\s+/g,
        (m) => m.index + m[0].length,
        minCut,
        maxCut,
        idealCut,
      );
    }

    // 4a. Fallback: single newline
    if (cut === null) {
      cut = findBestCut(markdown, /\n/g, (m) => m.index + 1, minCut, maxCut, idealCut);
    }

    // 4b. Fallback: whitespace
    if (cut === null) {
      cut = findBestCut(markdown, /\s+/g, (m) => m.index + m[0].length, minCut, maxCut, idealCut);
    }

    // 5. Absolute fallback: hard cut at target
    if (cut === null || cut <= cursor) {
      cut = Math.min(end, cursor + target);
    }

    if (cut <= cursor) {
      cut = Math.min(end, cursor + 1);
    }

    spans.push({ start: cursor, end: cut });
    cursor = cut;
  }

  if (cursor < end) spans.push({ start: cursor, end });
  return spans;
}

/**
 * Slices `markdown` into chunks the cleanup request can round-trip.
 *
 * - A document at or below `fastPathThreshold` is returned whole as one chunk.
 * - Larger documents are cut at block edges, merging forward while the target still holds.
 * - A text run larger than the target is cut at its own line breaks; a code/table/quote run is kept
 *   whole even when it exceeds the target, because a half-sent table is worse than a large one.
 * - A heading with no body is carried into the following chunk, so the model is never handed a
 *   section with nothing to clean.
 *
 * Chunk contents are the source document's own bytes, in order: reassembly is lossless by
 * construction, and the caller can hand the joined result back as the cleaned document.
 */
export function chunkDocument(markdown: string, options?: ChunkingOptions): DocumentChunk[] {
  const target = options?.targetChunkChars ?? DEFAULT_TARGET_CHUNK_CHARS;
  const threshold = options?.fastPathThreshold ?? DEFAULT_FAST_PATH_THRESHOLD;

  if (markdown.length === 0) {
    return [{ index: 0, total: 1, content: markdown, charRange: [0, 0] }];
  }

  const { blocks, headings } = scanDocument(markdown);

  if (markdown.length <= threshold) {
    const heading = headingAt(headings, 0);
    return [
      {
        index: 0,
        total: 1,
        content: markdown,
        ...(heading ? { heading } : {}),
        charRange: [0, markdown.length],
      },
    ];
  }

  // Carry a body-less heading into the following block instead of leaving it stranded.
  const spans: { start: number; end: number; atomic: boolean }[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (isHeadingOnly(blocks, index)) {
      const next = blocks[index + 1];
      if (next) {
        next.start = block.start;
        continue;
      }
      const previous = spans[spans.length - 1];
      if (previous) {
        previous.end = block.end;
        continue;
      }
    }
    spans.push({ start: block.start, end: block.end, atomic: block.kind === 'fence' || block.kind === 'table' || block.kind === 'quote' });
  }

  // Break only what may be broken, then pack the pieces greedily.
  const pieces: { start: number; end: number }[] = [];
  for (const span of spans) {
    if (span.end - span.start <= target || span.atomic) pieces.push(span);
    else pieces.push(...splitTextRun(markdown, span.start, span.end, target));
  }

  const chunks: { start: number; end: number }[] = [];
  for (const piece of pieces) {
    const last = chunks[chunks.length - 1];
    if (last && piece.end - last.start <= target) {
      last.end = piece.end;
      continue;
    }
    chunks.push({ start: piece.start, end: piece.end });
  }

  return chunks.map((chunk, index) => {
    const heading = headingAt(headings, chunk.start);
    return {
      index,
      total: chunks.length,
      content: markdown.slice(chunk.start, chunk.end),
      ...(heading ? { heading } : {}),
      charRange: [chunk.start, chunk.end] as [number, number],
    };
  });
}

/**
 * The document's heading lines, one per line — the cheap deterministic outline injected into every
 * chunked request so the model keeps the document's own vocabulary and structure in view without a
 * second round trip.
 */
export function extractDocumentOutline(markdown: string): string {
  return markdown
    .split('\n')
    .filter((line) => HEADING_LINE.test(line))
    .join('\n');
}
