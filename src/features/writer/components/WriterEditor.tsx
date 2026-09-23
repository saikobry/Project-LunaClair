import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
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
  $convertSelectionToMarkdownString,
  $convertToMarkdownString,
  $generateNodesFromMarkdownString,
} from '@lexical/markdown';
import {
  $getSelection,
  $isRangeSelection,
  $setSelection,
  type EditorState,
  type LexicalEditor,
  type RangeSelection,
} from 'lexical';
import { standardNodes } from '../nodes/standardNodes';
import { standardTransformers } from '../transformers/standardTransformers';
import { writerTheme } from '../theme/writerTheme';
import { WriterToolbar } from './WriterToolbar';

interface InitialContentPluginProps {
  markdown: string;
}

function InitialContentPlugin({ markdown }: InitialContentPluginProps) {
  const [editor] = useLexicalComposerContext();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    editor.update(
      () => {
        const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        $convertFromMarkdownString(normalized, standardTransformers);
      },
      { discrete: true },
    );
  }, [editor, markdown]);

  return null;
}

/**
 * The editor's active selection, as reported to a host surface.
 *
 * Both forms are published because they answer different questions: `text` is what a tool sends to
 * a model, `markdown` is what a Markdown-level replacement would target.
 */
export interface WriterSelection {
  /** The selected text, in plain text. */
  text: string;
  /** The selection in Markdown source form. */
  markdown: string;
}

/**
 * Imperative surface a host surface uses to act on the editor's selection.
 *
 * Exists so an async tool (AI cleanup) can clean the selection it was handed and put the result
 * back exactly where the user pointed, without the host having to own Lexical internals.
 */
export interface WriterEditorHandle {
  /**
   * Replaces the current selection with Markdown, parsed into real editor nodes rather than inserted
   * as literal text. Runs inside the editor's own history, so a single undo restores the original
   * text. Returns `false` when there is no selection left to replace.
   */
  replaceSelection(markdown: string): boolean;
}

interface SelectionBridgePluginProps {
  onSelectionChange?: (selection: WriterSelection | null) => void;
  handleRef?: Ref<WriterEditorHandle>;
}

function isAttached(selection: RangeSelection): boolean {
  return selection.anchor.getNode().isAttached() && selection.focus.getNode().isAttached();
}

/**
 * Publishes the editor's selection to the host and lets the host replace it.
 *
 * The click that reaches a toolbar button moves focus out of the editor, and the browser may collapse
 * the DOM selection doing it — so the last usable selection is remembered together with the document
 * Markdown it was taken from. A remembered selection survives a blur (the button must still say
 * "Clean Selection" after the click that started the work) but not a content change, because its
 * offsets would then point at different text.
 */
function SelectionBridgePlugin({ onSelectionChange, handleRef }: SelectionBridgePluginProps) {
  const [editor] = useLexicalComposerContext();
  const rememberedRef = useRef<{ selection: RangeSelection; documentMarkdown: string } | null>(null);
  const callbackRef = useRef(onSelectionChange);

  useEffect(() => {
    callbackRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    const publish = (value: WriterSelection | null) => callbackRef.current?.(value);

    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const documentMarkdown = $convertToMarkdownString(standardTransformers);
        const live = $getSelection();

        if ($isRangeSelection(live) && !live.isCollapsed()) {
          const text = live.getTextContent();
          if (text) {
            rememberedRef.current = { selection: live.clone(), documentMarkdown };
            publish({
              text,
              markdown: $convertSelectionToMarkdownString(standardTransformers, live),
            });
            return;
          }
        }

        const remembered = rememberedRef.current;
        if (remembered && remembered.documentMarkdown === documentMarkdown && isAttached(remembered.selection)) {
          publish({
            text: remembered.selection.getTextContent(),
            markdown: $convertSelectionToMarkdownString(standardTransformers, remembered.selection),
          });
          return;
        }

        rememberedRef.current = null;
        publish(null);
      });
    });
  }, [editor]);

  useImperativeHandle(
    handleRef,
    () => ({
      replaceSelection: (markdown: string): boolean => {
        let replaced = false;

        // `discrete` runs the update synchronously, so the boolean is decided before it returns.
        editor.update(
          () => {
            const live = $getSelection();
            let target: RangeSelection | null =
              $isRangeSelection(live) && !live.isCollapsed() ? live : null;

            if (!target) {
              const remembered = rememberedRef.current;
              if (remembered && isAttached(remembered.selection)) {
                const restored = remembered.selection.clone();
                $setSelection(restored);
                target = restored;
              }
            }

            if (!target) return;

            const nodes = $generateNodesFromMarkdownString(markdown, standardTransformers);
            if (nodes.length === 0) return;

            target.insertNodes(nodes);
            replaced = true;
          },
          { discrete: true },
        );

        return replaced;
      },
    }),
    [editor],
  );

  return null;
}

export interface WriterEditorProps {
  initialMarkdown?: string;
  placeholder?: string;
  onChange?: (markdown: string, editorState: EditorState) => void;
  readOnly?: boolean;
  /** Called whenever the editor's selection changes; `null` when there is nothing selected. */
  onSelectionChange?: (selection: WriterSelection | null) => void;
  /** Imperative handle for acting on the current selection (see `WriterEditorHandle`). */
  editorRef?: Ref<WriterEditorHandle>;
}

export function WriterEditor({
  initialMarkdown = '',
  placeholder = 'Start writing your study material...',
  onChange,
  readOnly = false,
  onSelectionChange,
  editorRef,
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
          <SelectionBridgePlugin onSelectionChange={onSelectionChange} handleRef={editorRef} />
          <InitialContentPlugin
            markdown={initialMarkdown}
          />
        </div>
      </div>
    </LexicalComposer>
  );
}
