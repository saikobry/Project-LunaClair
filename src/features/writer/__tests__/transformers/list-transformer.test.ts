import { describe, it, expect } from 'vitest';
import { markdownToLexical, lexicalToMarkdown } from '../harness/testEditor';
import { serializeLexicalStructure } from '../harness/lexicalSnapshot';
import { normalizeMarkdown } from '../harness/markdownNormalizer';
import { listFixtures } from '../fixtures/synthetic/lists';

describe('List Transformers (Enhanced Lists)', () => {
  it('imports simple unordered lists into ListNode with bullet type', () => {
    const md = listFixtures.simpleUnordered;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    const listNode = ast.children?.find((node) => node.type === 'list');
    expect(listNode).toBeDefined();
    expect(listNode?.props?.listType).toBe('bullet');
    expect(listNode?.children?.length).toBe(3);
  });

  it('imports simple ordered lists into ListNode with number type', () => {
    const md = listFixtures.simpleOrdered;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    const listNode = ast.children?.find((node) => node.type === 'list');
    expect(listNode).toBeDefined();
    expect(listNode?.props?.listType).toBe('number');
    expect(listNode?.children?.length).toBe(3);
  });

  it('handles 2-space nested lists indentation in AST and export', () => {
    const md = listFixtures.nestedTwoSpaces;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    const listNode = ast.children?.find((node) => node.type === 'list');
    expect(listNode).toBeDefined();

    const exported = lexicalToMarkdown(editor);
    expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(md));
  });

  it('characterizes 4-space nested lists indentation', () => {
    const md = listFixtures.nestedFourSpaces;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    const listNode = ast.children?.find((node) => node.type === 'list');
    expect(listNode).toBeDefined();
  });

  it('characterizes mixed ordered and unordered lists', () => {
    const md = listFixtures.mixedLists;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    expect(ast.children).toBeDefined();
    const lists = ast.children?.filter((node) => node.type === 'list');
    expect(lists?.length).toBeGreaterThan(0);
  });

  it('characterizes checklist nodes with checked states', () => {
    const md = listFixtures.checklists;
    const editor = markdownToLexical(md);
    const ast = serializeLexicalStructure(editor);

    const listNode = ast.children?.find((node) => node.type === 'list');
    expect(listNode).toBeDefined();
  });
});
