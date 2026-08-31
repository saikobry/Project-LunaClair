import { describe, it, expect } from 'vitest';
import { markdownToLexical, lexicalToMarkdown } from '../harness/testEditor';
import { serializeLexicalStructure } from '../harness/lexicalSnapshot';

describe('Markdown Fidelity — Unsupported Constructs & Fallbacks', () => {
  describe('Unsupported but Harmless Syntax (Category C)', () => {
    it('characterizes raw HTML div fallback without crashing the editor', () => {
      const input = `<div class="custom-card">
  Custom HTML content
</div>`;

      expect(() => {
        const editor = markdownToLexical(input);
        const ast = serializeLexicalStructure(editor);
        expect(ast.children).toBeDefined();
      }).not.toThrow();
    });

    it('characterizes unsupported footnote references gracefully', () => {
      const input = `Here is a statement with a footnote[^1].

[^1]: This is the footnote definition.`;

      expect(() => {
        const editor = markdownToLexical(input);
        const exported = lexicalToMarkdown(editor);
        expect(exported).toBeDefined();
      }).not.toThrow();
    });

    it('characterizes definition list syntax gracefully as paragraphs or standard text', () => {
      const input = `Term 1
: Definition 1`;

      expect(() => {
        const editor = markdownToLexical(input);
        const ast = serializeLexicalStructure(editor);
        expect(ast.children).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Dangerous Syntax Handled Gracefully (Category D)', () => {
    it('characterizes embedded script tags without throwing unhandled exceptions', () => {
      const input = `<script>alert("xss")</script>
Safe text content`;

      expect(() => {
        const editor = markdownToLexical(input);
        const ast = serializeLexicalStructure(editor);
        expect(ast.children).toBeDefined();
      }).not.toThrow();
    });
  });
});
