import { useCallback, useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_CRITICAL,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import {
  $isHeadingNode,
  $isQuoteNode,
} from '@lexical/rich-text';
import {
  $createListNode,
  $isListNode,
} from '@lexical/list';
import { $isCodeNode } from '@lexical/code';
import { $isLinkNode } from '@lexical/link';
import { $getNearestNodeOfType } from '@lexical/utils';
import * as stylex from '@stylexjs/stylex';
import { toolbarStyles } from './toolbar/toolbarStyles';
import { WriterToolbarHistory } from './toolbar/WriterToolbarHistory';
import { WriterToolbarBlockFormat } from './toolbar/WriterToolbarBlockFormat';
import { WriterToolbarInlineFormat } from './toolbar/WriterToolbarInlineFormat';
import { WriterToolbarIndents } from './toolbar/WriterToolbarIndents';
import { WriterToolbarInserts } from './toolbar/WriterToolbarInserts';

interface ToolbarFormatState {
  blockType: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isCode: boolean;
  isLink: boolean;
}

const initialFormatState: ToolbarFormatState = {
  blockType: 'paragraph',
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  isCode: false,
  isLink: false,
};

export function WriterToolbar() {
  const [editor] = useLexicalComposerContext();
  const [formatState, setFormatState] = useState<ToolbarFormatState>(initialFormatState);

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const isBold = selection.hasFormat('bold');
      const isItalic = selection.hasFormat('italic');
      const isUnderline = selection.hasFormat('underline');
      const isStrikethrough = selection.hasFormat('strikethrough');
      const isCode = selection.hasFormat('code');

      // Link format
      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === 'root'
          ? anchorNode
          : $isRootOrShadowRoot(anchorNode)
            ? anchorNode
            : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);

      const parentNode = anchorNode.getParent();
      const isLink = $isLinkNode(parentNode) || $isLinkNode(anchorNode);

      let blockType = 'paragraph';
      if (elementDOM !== null) {
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, $createListNode as unknown as typeof element.constructor);
          blockType = parentList ? (parentList as unknown as { getListType: () => string }).getListType() : element.getListType();
        } else {
          blockType = $isHeadingNode(element)
            ? element.getTag()
            : $isQuoteNode(element)
              ? 'quote'
              : $isCodeNode(element)
                ? 'code'
                : 'paragraph';
        }
      }

      setFormatState({
        blockType,
        isBold,
        isItalic,
        isUnderline,
        isStrikethrough,
        isCode,
        isLink,
      });
    }
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        $updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, $updateToolbar]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        $updateToolbar();
      });
    });
  }, [editor, $updateToolbar]);

  return (
    <div {...stylex.props(toolbarStyles.toolbar)} aria-label="Editor Toolbar" role="toolbar">
      <WriterToolbarHistory />
      <div {...stylex.props(toolbarStyles.divider)} />
      <WriterToolbarBlockFormat blockType={formatState.blockType} />
      <div {...stylex.props(toolbarStyles.divider)} />
      <WriterToolbarInlineFormat formats={formatState} />
      <div {...stylex.props(toolbarStyles.divider)} />
      <WriterToolbarIndents />
      <div {...stylex.props(toolbarStyles.divider)} />
      <WriterToolbarInserts />
    </div>
  );
}
