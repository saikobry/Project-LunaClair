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
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const targetEditor = editor ?? createTestEditor();
  targetEditor.update(
    () => {
      $convertFromMarkdownString(normalized, standardTransformers);
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
