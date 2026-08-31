import { describe, it, expect } from 'vitest';
import { markdownToLexical, lexicalToMarkdown } from '../harness/testEditor';
import { serializeLexicalStructure } from '../harness/lexicalSnapshot';
import { normalizeMarkdown } from '../harness/markdownNormalizer';
import { basicFormattingFixtures } from '../fixtures/synthetic/basic-formatting';
import { listFixtures } from '../fixtures/synthetic/lists';
import { tableFixtures } from '../fixtures/synthetic/tables';
import { codeBlockFixtures } from '../fixtures/synthetic/code-blocks';
import { imagesAndLinksFixtures } from '../fixtures/synthetic/images-and-links';
import { complexFixtures } from '../fixtures/synthetic/complex';
import { anatomyPhysiologyExcerpt } from '../fixtures/real-material/anatomy-physiology';
import { cellStructureExcerpt } from '../fixtures/real-material/cell-structure';
import { spanishVerbsExcerpt } from '../fixtures/real-material/spanish-verbs';

describe('Markdown Fidelity — Round-Trip Suite', () => {
  describe('Synthetic Fixtures Round-Trip', () => {
    it('round-trips headings fixture preserving semantic AST structure', () => {
      const input = basicFormattingFixtures.headings;
      const editor1 = markdownToLexical(input);
      const ast1 = serializeLexicalStructure(editor1);

      const exported = lexicalToMarkdown(editor1);
      const editor2 = markdownToLexical(exported);
      const ast2 = serializeLexicalStructure(editor2);

      expect(ast2).toEqual(ast1);
      expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
    });

    it('round-trips basic inline formatting preserving text and style tokens', () => {
      const input = basicFormattingFixtures.inlineStyles;
      const editor1 = markdownToLexical(input);
      const ast1 = serializeLexicalStructure(editor1);

      const exported = lexicalToMarkdown(editor1);
      const editor2 = markdownToLexical(exported);
      const ast2 = serializeLexicalStructure(editor2);

      expect(ast2).toEqual(ast1);
      expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
    });

    it('round-trips simple unordered and ordered lists', () => {
      const input = listFixtures.simpleUnordered;
      const editor1 = markdownToLexical(input);
      const ast1 = serializeLexicalStructure(editor1);

      const exported = lexicalToMarkdown(editor1);
      const editor2 = markdownToLexical(exported);
      const ast2 = serializeLexicalStructure(editor2);

      expect(ast2).toEqual(ast1);
      expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
    });

    it('round-trips standard GFM tables with column integrity', () => {
      const input = tableFixtures.simpleTable;
      const editor1 = markdownToLexical(input);
      const ast1 = serializeLexicalStructure(editor1);

      const exported = lexicalToMarkdown(editor1);
      const editor2 = markdownToLexical(exported);
      const ast2 = serializeLexicalStructure(editor2);

      expect(ast2).toEqual(ast1);
      expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
    });

    it('round-trips fenced code blocks preserving language tags and code formatting', () => {
      const input = codeBlockFixtures.typescriptBlock;
      const editor1 = markdownToLexical(input);
      const ast1 = serializeLexicalStructure(editor1);

      const exported = lexicalToMarkdown(editor1);
      const editor2 = markdownToLexical(exported);
      const ast2 = serializeLexicalStructure(editor2);

      expect(ast2).toEqual(ast1);
      expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
    });

    it('round-trips images and links fixtures without attribute degradation', () => {
      const input = imagesAndLinksFixtures.simpleImage;
      const editor1 = markdownToLexical(input);
      const ast1 = serializeLexicalStructure(editor1);

      const exported = lexicalToMarkdown(editor1);
      const editor2 = markdownToLexical(exported);
      const ast2 = serializeLexicalStructure(editor2);

      expect(ast2).toEqual(ast1);
      expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
    });

    it('characterizes complex multi-construct synthetic document round-trip', () => {
      const input = complexFixtures.documentWithAllFeatures;
      const editor1 = markdownToLexical(input);
      const ast1 = serializeLexicalStructure(editor1);

      const exported = lexicalToMarkdown(editor1);
      const editor2 = markdownToLexical(exported);
      const ast2 = serializeLexicalStructure(editor2);

      expect(ast2).toEqual(ast1);
      expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
    });
  });

  describe('Real LunaClair Study Material Fixtures Round-Trip', () => {
    it('characterizes Anatomy & Physiology material round-trip', () => {
      const input = anatomyPhysiologyExcerpt;
      const editor1 = markdownToLexical(input);
      const ast1 = serializeLexicalStructure(editor1);

      const exported = lexicalToMarkdown(editor1);
      const editor2 = markdownToLexical(exported);
      const ast2 = serializeLexicalStructure(editor2);

      expect(ast2).toEqual(ast1);
      expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
    });

    it('characterizes Cell Structure material round-trip', () => {
      const input = cellStructureExcerpt;
      const editor1 = markdownToLexical(input);
      const ast1 = serializeLexicalStructure(editor1);

      const exported = lexicalToMarkdown(editor1);
      const editor2 = markdownToLexical(exported);
      const ast2 = serializeLexicalStructure(editor2);

      expect(ast2).toEqual(ast1);
      expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
    });

    it('characterizes Spanish Verbs material round-trip', () => {
      const input = spanishVerbsExcerpt;
      const editor1 = markdownToLexical(input);
      const ast1 = serializeLexicalStructure(editor1);

      const exported = lexicalToMarkdown(editor1);
      const editor2 = markdownToLexical(exported);
      const ast2 = serializeLexicalStructure(editor2);

      expect(ast2).toEqual(ast1);
      expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
    });
  });
});
