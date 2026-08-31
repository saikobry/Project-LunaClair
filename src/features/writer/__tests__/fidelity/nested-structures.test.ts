import { describe, it, expect } from 'vitest';
import { markdownToLexical, lexicalToMarkdown } from '../harness/testEditor';
import { serializeLexicalStructure } from '../harness/lexicalSnapshot';
import { normalizeMarkdown } from '../harness/markdownNormalizer';

describe('Markdown Fidelity — Nested Structures', () => {
  it('characterizes 3-level deep nested list AST and round-trip', () => {
    const input = `- Level 1
  - Level 2
    - Level 3`;

    const editor = markdownToLexical(input);
    const ast = serializeLexicalStructure(editor);

    const listNode = ast.children?.find((n) => n.type === 'list');
    expect(listNode).toBeDefined();

    const exported = lexicalToMarkdown(editor);
    expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
  });

  it('characterizes 4-level deep nested list AST and round-trip', () => {
    const input = `- Level 1
  - Level 2
    - Level 3
      - Level 4`;

    const editor = markdownToLexical(input);
    const ast = serializeLexicalStructure(editor);

    const listNode = ast.children?.find((n) => n.type === 'list');
    expect(listNode).toBeDefined();

    const exported = lexicalToMarkdown(editor);
    expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
  });

  it('characterizes table cells containing complex multi-token formatting', () => {
    const input = `| Property | Details |
| --- | --- |
| **Status** | \`Active\` with [Docs](https://lunaclair.app) and <u>Notes</u> |`;

    const editor = markdownToLexical(input);
    const ast = serializeLexicalStructure(editor);

    const table = ast.children?.find((n) => n.type === 'table');
    expect(table).toBeDefined();

    const bodyRow = table?.children?.[1];
    expect(bodyRow).toBeDefined();
  });

  it('characterizes list items with embedded inline styling', () => {
    const input = `- Item with **bold text**
- Item with \`code snippet\`
- Item with [hyperlink](https://lunaclair.app)`;

    const editor = markdownToLexical(input);
    const ast = serializeLexicalStructure(editor);

    const listNode = ast.children?.find((n) => n.type === 'list');
    expect(listNode).toBeDefined();
    expect(listNode?.children?.length).toBe(3);

    const exported = lexicalToMarkdown(editor);
    expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
  });
});
