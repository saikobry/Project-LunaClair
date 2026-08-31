import { describe, it, expect } from 'vitest';
import { markdownToLexical, lexicalToMarkdown } from '../harness/testEditor';
import { serializeLexicalStructure } from '../harness/lexicalSnapshot';
import { normalizeMarkdown } from '../harness/markdownNormalizer';
import { basicFormattingFixtures } from '../fixtures/synthetic/basic-formatting';

describe('Inline Transformers', () => {
  it('imports standard inline styles (bold, italic, underline, strike, code, highlight)', () => {
    const md = basicFormattingFixtures.inlineStyles;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    const paragraph = ast.children?.[0];
    expect(paragraph?.type).toBe('paragraph');

    const textNodes = paragraph?.children || [];
    const boldNode = textNodes.find((n) => n.formats?.includes('bold'));
    const italicNode = textNodes.find((n) => n.formats?.includes('italic'));
    const underlineNode = textNodes.find((n) => n.formats?.includes('underline'));
    const strikeNode = textNodes.find((n) => n.formats?.includes('strikethrough'));
    const codeNode = textNodes.find((n) => n.formats?.includes('code'));
    const highlightNode = textNodes.find((n) => n.formats?.includes('highlight'));

    expect(boldNode?.text).toBe('Bold text');
    expect(italicNode?.text).toBe('italic text');
    expect(underlineNode?.text).toBe('underlined text');
    expect(strikeNode?.text).toBe('strikethrough');
    expect(codeNode?.text).toBe('inline code');
    expect(highlightNode?.text).toBe('highlighted text');
  });

  it('exports underline transformer using <u> tags', () => {
    const md = 'This has <u>underlined content</u>.';
    const editor = markdownToLexical(md);
    const exported = lexicalToMarkdown(editor);

    expect(exported).toContain('<u>underlined content</u>');
  });

  it('characterizes combined inline styles (bold + italic, bold + underline)', () => {
    const md = basicFormattingFixtures.combinedInline;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    const paragraph = ast.children?.[0];
    expect(paragraph?.type).toBe('paragraph');
    expect(paragraph?.children?.length).toBeGreaterThan(0);

    // Check if bold underlined node has both formats
    const boldUnderlineNode = paragraph?.children?.find(
      (n) => n.formats?.includes('bold') && n.formats?.includes('underline'),
    );
    expect(boldUnderlineNode).toBeDefined();
  });

  it('round-trips standard inline styles with fidelity', () => {
    const md = basicFormattingFixtures.inlineStyles;
    const editor = markdownToLexical(md);
    const exported = lexicalToMarkdown(editor);

    expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(md));
  });
});
