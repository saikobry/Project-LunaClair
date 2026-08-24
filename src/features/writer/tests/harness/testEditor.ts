import { createEditor, type LexicalEditor } from 'lexical';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from '@lexical/markdown';
import { standardNodes } from '../../nodes/standardNodes';
import { standardTransformers } from '../../transformers/standardTransformers';

export function createTestEditor(): LexicalEditor {
  return createEditor({
    nodes: standardNodes,
    onError: (error) => {
      throw error;
    },
  });
}

/**
 * Parses markdown into a Lexical editor instance.
 */
export function markdownToLexical(
  markdown: string,
  editor?: LexicalEditor,
): LexicalEditor {
  const targetEditor = editor ?? createTestEditor();
  targetEditor.update(
    () => {
      $convertFromMarkdownString(markdown, standardTransformers);
    },
    { discrete: true },
  );
  return targetEditor;
}

/**
 * Exports a Lexical editor instance back into a markdown string.
 */
export function lexicalToMarkdown(editor: LexicalEditor): string {
  return editor.getEditorState().read(() => {
    return $convertToMarkdownString(standardTransformers);
  });
}

/**
 * Performs full Markdown -> Lexical -> Markdown round-trip conversion.
 */
export function roundTripMarkdown(markdown: string): string {
  const editor = markdownToLexical(markdown);
  return lexicalToMarkdown(editor);
}
