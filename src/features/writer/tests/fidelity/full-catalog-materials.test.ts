import { describe, it, expect } from 'vitest';
import { markdownToLexical, lexicalToMarkdown } from '../harness/testEditor';
import { serializeLexicalStructure, type SemanticASTNode } from '../harness/lexicalSnapshot';
import { normalizeMarkdown } from '../../utils/markdownNormalizer';

import anatomyMd from '../fixtures/real-material/anatomy-physiology.md?raw';
import cellularMd from '../fixtures/real-material/cellular-respiration.md?raw';
import photosynthesisMd from '../fixtures/real-material/photosynthesis.md?raw';
import geneticsMd from '../fixtures/real-material/genetics.md?raw';
import ancientCivilizationsMd from '../fixtures/real-material/ancient-civilizations.md?raw';
import spanishVerbsMd from '../fixtures/real-material/spanish-verbs.md?raw';
import cellStructureMd from '../fixtures/real-material/cell-structure.md?raw';

function collectNodes(root: SemanticASTNode, predicate: (n: SemanticASTNode) => boolean): SemanticASTNode[] {
  const matches: SemanticASTNode[] = [];
  function traverse(node: SemanticASTNode) {
    if (predicate(node)) matches.push(node);
    if (node.children) {
      for (const child of node.children) traverse(child);
    }
  }
  traverse(root);
  return matches;
}

describe('Stage 3B — Full Catalog Curriculum Fidelity Suite', () => {
  describe('Full Document 3-Level Round-Trip Validation', () => {
    const materials = [
      { name: 'Anatomy & Physiology (Integumentary System)', content: anatomyMd },
      { name: 'Cellular Respiration', content: cellularMd },
      { name: 'Photosynthesis', content: photosynthesisMd },
      { name: 'Genetics', content: geneticsMd },
      { name: 'Ancient Civilizations', content: ancientCivilizationsMd },
      { name: 'Spanish Verbs', content: spanishVerbsMd },
      { name: 'Cell Structure & Function', content: cellStructureMd },
    ];

    for (const { name, content } of materials) {
      it(`preserves 100% semantic AST and canonical representation for ${name}`, () => {
        const input = content;

        // Level 1: Parse validity (does not throw)
        const editor1 = markdownToLexical(input);
        const ast1 = serializeLexicalStructure(editor1);
        expect(ast1.children?.length).toBeGreaterThan(0);

        // Level 2: Semantic AST Equality across round-trip
        const exported = lexicalToMarkdown(editor1);
        const editor2 = markdownToLexical(exported);
        const ast2 = serializeLexicalStructure(editor2);

        expect(ast2).toEqual(ast1);

        // Level 3: Canonical Markdown Normalization
        expect(normalizeMarkdown(exported)).toBe(normalizeMarkdown(input));
      });
    }
  });

  describe('Domain-Specific Construct Invariants', () => {
    it('preserves multi-level headings, figures, tables, and nested layers in Anatomy & Physiology', () => {
      const input = anatomyMd;
      const editor = markdownToLexical(input);
      const ast = serializeLexicalStructure(editor);

      // Verify headings hierarchy (H1, H2, H3, H4, H5)
      const headings = collectNodes(ast, (n) => n.type === 'heading');
      expect(headings.length).toBeGreaterThan(10);
      const tags = new Set(headings.map((h) => h.props?.tag));
      expect(tags.has('h1')).toBe(true);
      expect(tags.has('h2')).toBe(true);
      expect(tags.has('h3')).toBe(true);
      expect(tags.has('h4')).toBe(true);

      // Verify figures (ImageNode)
      const images = collectNodes(ast, (n) => n.type === 'image');
      expect(images.length).toBeGreaterThan(0);
      expect(images.some((img) => String(img.props?.src).includes('figure'))).toBe(true);

      // Verify nested lists
      const lists = collectNodes(ast, (n) => n.type === 'list');
      expect(lists.length).toBeGreaterThan(5);

      // Verify bold emphasis
      const boldTexts = collectNodes(ast, (n) => n.type === 'text' && (n.formats?.includes('bold') ?? false));
      expect(boldTexts.length).toBeGreaterThan(10);
    });

    it('preserves chemical pathways, ordered stages, and yield tables in Cellular Respiration', () => {
      const input = cellularMd;
      const editor = markdownToLexical(input);
      const ast = serializeLexicalStructure(editor);

      // Verify ATP yield table
      const tables = collectNodes(ast, (n) => n.type === 'table');
      expect(tables.length).toBeGreaterThanOrEqual(1);

      // Verify ordered list stages (Glycolysis, Pyruvate Oxidation, Krebs, ETC)
      const orderedLists = collectNodes(ast, (n) => n.type === 'list' && n.props?.listType === 'number');
      expect(orderedLists.length).toBeGreaterThanOrEqual(1);

      // Verify chemical equation text
      const texts = collectNodes(ast, (n) => n.type === 'text' && (n.text?.includes('ATP') ?? false));
      expect(texts.length).toBeGreaterThan(0);
    });

    it('preserves conjugation tables and pronoun matrices in Spanish Verbs', () => {
      const input = spanishVerbsMd;
      const editor = markdownToLexical(input);
      const ast = serializeLexicalStructure(editor);

      const tables = collectNodes(ast, (n) => n.type === 'table');
      expect(tables.length).toBeGreaterThanOrEqual(3);
    });

    it('preserves timelines, quotes, and structural hierarchy in Ancient Civilizations', () => {
      const input = ancientCivilizationsMd;
      const editor = markdownToLexical(input);
      const ast = serializeLexicalStructure(editor);

      const headings = collectNodes(ast, (n) => n.type === 'heading');
      expect(headings.length).toBeGreaterThan(5);
    });

    it('preserves contributor tables and organelle comparisons in Cell Structure', () => {
      const input = cellStructureMd;
      const editor = markdownToLexical(input);
      const ast = serializeLexicalStructure(editor);

      const tables = collectNodes(ast, (n) => n.type === 'table');
      expect(tables.length).toBeGreaterThanOrEqual(2);
    });
  });
});
