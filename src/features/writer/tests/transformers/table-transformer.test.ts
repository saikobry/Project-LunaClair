import { describe, it, expect } from 'vitest';
import { markdownToLexical, lexicalToMarkdown } from '../harness/testEditor';
import { serializeLexicalStructure } from '../harness/lexicalSnapshot';
import { normalizeMarkdown } from '../harness/markdownNormalizer';
import { tableFixtures } from '../fixtures/synthetic/tables';

describe('Table Transformer (GFM)', () => {
  it('imports simple GFM table into TableNode with TableRow and TableCell nodes', () => {
    const md = tableFixtures.simpleTable;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    expect(ast.children).toBeDefined();
    const table = ast.children?.find((node) => node.type === 'table');
    expect(table).toBeDefined();
    expect(table?.children?.length).toBe(3); // 1 header + 2 body rows

    // Header row should have header cells
    const headerRow = table?.children?.[0];
    expect(headerRow?.type === 'tablerow').toBe(true);
    expect(headerRow?.children?.length).toBe(3);
  });

  it('preserves inline formatting inside table cells', () => {
    const md = tableFixtures.formattedCellsTable;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    const table = ast.children?.find((node) => node.type === 'table');
    expect(table).toBeDefined();

    // Check first body row for bold nucleus and italic genetic control
    const bodyRow1 = table?.children?.[1];
    expect(bodyRow1).toBeDefined();

    const cell1 = bodyRow1?.children?.[0];
    const p1 = cell1?.children?.[0];
    const text1 = p1?.type === 'paragraph' ? p1.children?.[0] : p1;
    expect(text1?.type).toBe('text');
    expect(text1?.formats).toContain('bold');
    expect(text1?.text).toBe('Nucleus');

    const cell2 = bodyRow1?.children?.[1];
    const p2 = cell2?.children?.[0];
    const text2 = p2?.type === 'paragraph' ? p2.children?.[0] : p2;
    expect(text2?.type).toBe('text');
    expect(text2?.formats).toContain('italic');
    expect(text2?.text).toBe('Genetic control');
  });

  it('exports table nodes back to valid GFM markdown', () => {
    const md = tableFixtures.simpleTable;
    const editor = markdownToLexical(md);
    const exported = lexicalToMarkdown(editor);

    expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(md));
  });

  it('characterizes empty and uneven cells in table parsing', () => {
    const md = tableFixtures.emptyAndUnevenCells;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    const table = ast.children?.find((node) => node.type === 'table');
    expect(table).toBeDefined();
  });

  it('characterizes escaped pipe handling in table cells', () => {
    const md = tableFixtures.escapedPipes;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    const table = ast.children?.find((node) => node.type === 'table');
    expect(table).toBeDefined();

    const bodyRow = table?.children?.[1];
    // Escaped pipe \| should not be split into multiple cells
    expect(bodyRow?.children?.length).toBe(2);
  });

  it('round-trips tables with escaped pipes without structural degradation', () => {
    const md = tableFixtures.escapedPipes;
    const editor1 = markdownToLexical(md);
    const ast1 = serializeLexicalStructure(editor1);

    const exported = lexicalToMarkdown(editor1);
    const editor2 = markdownToLexical(exported);
    const ast2 = serializeLexicalStructure(editor2);

    expect(ast2).toEqual(ast1);
  });

  it('round-trips tables with empty and uneven cells without error', () => {
    const md = tableFixtures.emptyAndUnevenCells;
    const editor1 = markdownToLexical(md);
    const ast1 = serializeLexicalStructure(editor1);

    const exported = lexicalToMarkdown(editor1);
    const editor2 = markdownToLexical(exported);
    const ast2 = serializeLexicalStructure(editor2);

    expect(ast2).toEqual(ast1);
  });
});
