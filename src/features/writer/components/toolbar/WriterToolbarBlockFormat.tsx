import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
} from 'lexical';
import {
  $createHeadingNode,
  $createQuoteNode,
  type HeadingTagType,
} from '@lexical/rich-text';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { $createCodeNode } from '@lexical/code';
import * as stylex from '@stylexjs/stylex';
import { toolbarStyles } from './toolbarStyles';

const blockTypeToBlockName: Record<string, string> = {
  paragraph: 'Normal Text',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  h5: 'Heading 5',
  h6: 'Heading 6',
  bullet: 'Bullet List',
  number: 'Numbered List',
  quote: 'Quote Block',
  code: 'Code Block',
};

interface WriterToolbarBlockFormatProps {
  blockType: string;
}

export function WriterToolbarBlockFormat({ blockType }: WriterToolbarBlockFormatProps) {
  const [editor] = useLexicalComposerContext();

  const handleBlockChange = (newBlockType: string) => {
    if (newBlockType === blockType) return;

    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (newBlockType === 'paragraph') {
          const anchorNode = selection.anchor.getNode();
          const target = anchorNode.getTopLevelElementOrThrow();
          target.replace($createParagraphNode());
        } else if (newBlockType.startsWith('h')) {
          const anchorNode = selection.anchor.getNode();
          const target = anchorNode.getTopLevelElementOrThrow();
          target.replace($createHeadingNode(newBlockType as HeadingTagType));
        } else if (newBlockType === 'bullet') {
          if (blockType !== 'bullet') {
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
          } else {
            editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
          }
        } else if (newBlockType === 'number') {
          if (blockType !== 'number') {
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
          } else {
            editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
          }
        } else if (newBlockType === 'quote') {
          const anchorNode = selection.anchor.getNode();
          const target = anchorNode.getTopLevelElementOrThrow();
          target.replace($createQuoteNode());
        } else if (newBlockType === 'code') {
          const anchorNode = selection.anchor.getNode();
          const target = anchorNode.getTopLevelElementOrThrow();
          target.replace($createCodeNode());
        }
      }
    });
  };

  return (
    <div {...stylex.props(toolbarStyles.group)}>
      <select
        {...stylex.props(toolbarStyles.select)}
        value={blockType}
        onChange={(e) => handleBlockChange(e.target.value)}
        aria-label="Block Format"
      >
        {Object.entries(blockTypeToBlockName).map(([val, label]) => (
          <option key={val} value={val}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
