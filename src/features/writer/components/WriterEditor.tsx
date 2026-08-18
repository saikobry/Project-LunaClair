import { useEffect, useRef } from 'react';
import {
  type InitialConfigType,
  LexicalComposer,
} from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from '@lexical/markdown';
import type { EditorState, LexicalEditor } from 'lexical';
import { standardNodes } from '../nodes/standardNodes';
import { standardTransformers } from '../transformers/standardTransformers';
import { writerTheme } from '../theme/writerTheme';
import { WriterToolbar } from './WriterToolbar';

interface InitialContentPluginProps {
  markdown: string;
}

function InitialContentPlugin({ markdown }: InitialContentPluginProps) {
  const [editor] = useLexicalComposerContext();
  const lastMarkdownRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastMarkdownRef.current === markdown) return;
    lastMarkdownRef.current = markdown;

    editor.update(
      () => {
        $convertFromMarkdownString(markdown, standardTransformers);
      },
      { discrete: true },
    );
  }, [editor, markdown]);

  return null;
}

export interface WriterEditorProps {
  initialMarkdown?: string;
  placeholder?: string;
  onChange?: (markdown: string, editorState: EditorState) => void;
  readOnly?: boolean;
}

export function WriterEditor({
  initialMarkdown = '',
  placeholder = 'Start writing your study material...',
  onChange,
  readOnly = false,
}: WriterEditorProps) {
  const initialConfig: InitialConfigType = {
    namespace: 'LunaClairWriter',
    theme: writerTheme,
    nodes: standardNodes,
    editable: !readOnly,
    onError: (error: Error) => {
      console.error('[LunaClair Writer Error]', error);
    },
  };

  const handleEditorChange = (
    editorState: EditorState,
    _editor: LexicalEditor,
  ) => {
    if (!onChange) return;
    editorState.read(() => {
      const markdown = $convertToMarkdownString(standardTransformers);
      onChange(markdown, editorState);
    });
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="writer-editor-container">
        {!readOnly && <WriterToolbar />}
        <div className="writer-editor-inner">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="writer-content-editable"
                aria-label="Study Material Editor"
              />
            }
            placeholder={
              <div className="writer-placeholder">{placeholder}</div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <TablePlugin />
          <LinkPlugin />
          <HorizontalRulePlugin />
          <MarkdownShortcutPlugin transformers={standardTransformers} />
          <OnChangePlugin onChange={handleEditorChange} ignoreSelectionChange />
          <InitialContentPlugin
            markdown={initialMarkdown}
          />
        </div>
      </div>
    </LexicalComposer>
  );
}
