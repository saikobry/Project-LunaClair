import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FAST_PATH_THRESHOLD,
  DEFAULT_TARGET_CHUNK_CHARS,
  chunkDocument,
  extractDocumentOutline,
  splitTextRun,
} from '../DocumentChunker';

/** A single wrapped paragraph line of exactly `chars` characters. */
function filler(chars: number, seed = 'word'): string {
  const unit = `${seed} `;
  return unit.repeat(Math.ceil(chars / unit.length)).slice(0, chars);
}

/** `paragraphs` separate paragraphs, each `size` characters — a text section of any length. */
function paragraphs(count: number, size: number): string {
  return Array.from({ length: count }, (_, index) => filler(size, `p${index}`)).join('\n\n');
}

describe('DocumentChunker', () => {
  it('returns the document as a single chunk when it is at or below the fast-path threshold', () => {
    const markdown = `# Title\n\n${filler(DEFAULT_FAST_PATH_THRESHOLD - 20)}`;

    const chunks = chunkDocument(markdown);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      index: 0,
      total: 1,
      content: markdown,
      heading: 'Title',
      charRange: [0, markdown.length],
    });
  });

  it('treats an empty document as one empty chunk rather than returning nothing', () => {
    expect(chunkDocument('')).toEqual([{ index: 0, total: 1, content: '', charRange: [0, 0] }]);
  });

  it('reassembles the document byte for byte from its chunks', () => {
    const markdown = [`# Doc`, '', ...Array.from({ length: 6 }, (_, i) => `## Section ${i}\n\n${paragraphs(4, 900)}`)].join('\n\n');

    const chunks = chunkDocument(markdown);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.content).join('')).toBe(markdown);
  });

  it('keeps every chunk within the target when the document can be divided at all', () => {
    const markdown = [`# Doc`, '', ...Array.from({ length: 6 }, (_, i) => `## Section ${i}\n\n${paragraphs(4, 900)}`)].join('\n\n');

    const chunks = chunkDocument(markdown);

    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(DEFAULT_TARGET_CHUNK_CHARS);
    }
  });

  it('numbers chunks and reports contiguous, non-overlapping ranges that cover the document', () => {
    const markdown = `# Doc\n\n${paragraphs(24, 700)}`;

    const chunks = chunkDocument(markdown);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, index) => {
      expect(chunk.index).toBe(index);
      expect(chunk.total).toBe(chunks.length);
      expect(chunk.charRange[1]).toBeGreaterThan(chunk.charRange[0]);
    });
    for (let index = 1; index < chunks.length; index += 1) {
      expect(chunks[index].charRange[0]).toBe(chunks[index - 1].charRange[1]);
    }
    expect(chunks[chunks.length - 1].charRange[1]).toBe(markdown.length);
  });

  it('never cuts inside a fenced code block, even when the block exceeds the target', () => {
    const code = filler(10_000, 'code');
    const markdown = `# Doc\n\n${filler(1_200, 'intro')}\n\n\`\`\`js\n${code}\n\`\`\`\n\n## After\n\n${filler(1_200, 'tail')}`;

    const chunks = chunkDocument(markdown);
    const fenceChunks = chunks.filter((chunk) => chunk.content.includes('```js'));

    expect(fenceChunks).toHaveLength(1);
    expect(fenceChunks[0].content.trimEnd().endsWith('```')).toBe(true);
    expect(fenceChunks[0].content).toContain(code);
    // No chunk may begin with the fence's body — that would mean the fence was split.
    expect(chunks.some((chunk) => chunk.content.startsWith('code'))).toBe(false);
  });

  it('never cuts inside a table, even when the table exceeds the target', () => {
    const rows = Array.from({ length: 60 }, (_, index) => `| Row ${index} | ${filler(120, `cell${index}`)} |`);
    const table = ['| Name | Value |', '| --- | --- |', ...rows].join('\n');
    const markdown = `# Doc\n\n${table}\n\n## After\n\n${filler(1_200, 'tail')}`;

    const chunks = chunkDocument(markdown);
    const tableChunks = chunks.filter((chunk) => chunk.content.includes('| Name | Value |'));

    expect(tableChunks).toHaveLength(1);
    expect(tableChunks[0].content).toContain('| Row 0 |');
    expect(tableChunks[0].content).toContain('| Row 59 |');
  });

  it('never cuts inside a blockquote run', () => {
    const quote = Array.from({ length: 200 }, (_, index) => `> ${filler(80, `line${index}`)}`).join('\n');
    const markdown = `${quote}\n\n## After\n\n${filler(1_200, 'tail')}`;

    const chunks = chunkDocument(markdown);
    const quoteChunks = chunks.filter((chunk) => chunk.content.includes('> line0 '));

    expect(quoteChunks).toHaveLength(1);
    expect(quoteChunks[0].content).toContain('line199');
  });

  it('splits a single paragraph larger than the target at its own line breaks', () => {
    const lines = Array.from({ length: 200 }, (_, index) => filler(100, `line${index}`)).join('\n');
    expect(lines.includes('\n\n')).toBe(false);

    const chunks = chunkDocument(`# Doc\n\n${lines}`);

    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(DEFAULT_TARGET_CHUNK_CHARS);
    }
    // Every cut landed on a line break, so no chunk begins mid-line.
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.content.endsWith('\n')).toBe(true);
    }
  });

  it('cuts an unbroken single-line run at the target rather than sending it whole', () => {
    const markdown = filler(20_000, 'blob');
    expect(markdown.includes('\n')).toBe(false);

    const chunks = chunkDocument(markdown);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(DEFAULT_TARGET_CHUNK_CHARS);
    }
    expect(chunks.map((chunk) => chunk.content).join('')).toBe(markdown);
  });

  it('carries a heading with no body into the following chunk', () => {
    const markdown = ['# Title', '', '## Empty Section', '', '## Real Section', '', paragraphs(14, 800)].join('\n');

    const chunks = chunkDocument(markdown);
    const withEmpty = chunks.find((chunk) => chunk.content.includes('## Empty Section'));

    expect(withEmpty).toBeDefined();
    expect(withEmpty?.content).toContain('## Real Section');
  });

  it('names each chunk with the heading in effect at its first line', () => {
    const markdown = ['# Alpha', '', paragraphs(8, 900), '', '# Beta', '', paragraphs(8, 900)].join('\n');

    const chunks = chunkDocument(markdown);

    expect(chunks[0].heading).toBe('Alpha');
    expect(chunks[chunks.length - 1].heading).toBe('Beta');
  });

  it('honours custom chunking options', () => {
    const markdown = `# Doc\n\n${paragraphs(6, 900)}`;

    const chunks = chunkDocument(markdown, { targetChunkChars: 2_000, fastPathThreshold: 0 });

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(2_000);
    }
  });

  it('extracts a flat outline of every heading line', () => {
    const markdown = '# Title\n\nIntro text\n\n## Alpha\n\nbody\n\n### Detail\n\nbody\n\n## Beta';

    expect(extractDocumentOutline(markdown)).toBe('# Title\n## Alpha\n### Detail\n## Beta');
  });

  it('returns an empty outline for a document with no headings', () => {
    expect(extractDocumentOutline('just a paragraph\nand another')).toBe('');
  });

  it('prioritizes paragraph breaks over sentence breaks within the elastic window', () => {
    // Window for target 200: [170, 230]
    const part1 = `${'A'.repeat(165)}. Sentence break. `; // sentence break at ~185
    const part2 = 'More text before break.\n\n'; // paragraph break at 185 + 25 = 210
    const part3 = 'Paragraph two is here and continues for another few sentences.';
    const text = part1 + part2 + part3;

    const spans = splitTextRun(text, 0, text.length, 200);

    expect(spans.length).toBeGreaterThan(1);
    const firstChunk = text.slice(spans[0].start, spans[0].end);
    expect(firstChunk.endsWith('\n\n')).toBe(true);
    expect(firstChunk).toBe(part1 + part2);
  });

  it('prioritizes list item boundaries over sentence breaks and single newlines', () => {
    // Window for target 200: [170, 230]
    const intro = 'Intro text '.repeat(15); // ~165 chars
    const sentence = 'Some sentence. '; // ~15 chars -> ~180 chars
    const listItem = '\n- First list item that continues for a long duration of text.';
    const text = intro + sentence + listItem;

    const spans = splitTextRun(text, 0, text.length, 200);

    expect(spans.length).toBeGreaterThan(1);
    const firstChunk = text.slice(spans[0].start, spans[0].end);
    const secondChunk = text.slice(spans[1].start, spans[1].end);

    expect(firstChunk.endsWith('\n')).toBe(true);
    expect(secondChunk.startsWith('- First list item')).toBe(true);
  });

  it('prioritizes sentence breaks over single newlines mid-sentence', () => {
    // Window for target 200: [160, 250]
    const fillerText = 'Line of ocr text here.\n'.repeat(8); // 8 * 23 = 184 chars
    const sentenceEnd = 'This sentence concludes here. '; // ends at 184 + 30 = 214
    const nextSentence = 'Next line wraps\nagain mid-sentence.';
    const text = fillerText + sentenceEnd + nextSentence;

    const spans = splitTextRun(text, 0, text.length, 200);

    expect(spans.length).toBeGreaterThan(1);
    const firstChunk = text.slice(spans[0].start, spans[0].end);
    expect(firstChunk.endsWith('here. ')).toBe(true);
  });

  it('snaps cleanly to paragraph breaks between 1.15 * target and 1.25 * target', () => {
    // Window for target 200: [160, 250]. Break at 240 is between 1.15x (230) and 1.25x (250).
    const part1 = `${'A'.repeat(160)}. Sentence here. `; // sentence break at 177 chars
    const part2 = `${'B'.repeat(61)}\n\n`; // paragraph break at 177 + 63 = 240 chars
    const part3 = 'Paragraph two is here and continues for another few sentences.';
    const text = part1 + part2 + part3;

    const spans = splitTextRun(text, 0, text.length, 200);

    expect(spans.length).toBeGreaterThan(1);
    const firstChunk = text.slice(spans[0].start, spans[0].end);
    expect(firstChunk.endsWith('\n\n')).toBe(true);
    expect(firstChunk).toBe(part1 + part2);
    expect(firstChunk.length).toBe(240);
  });
});
