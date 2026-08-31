import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  type ElementNode,
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
import { toolbarStyles } from './toolbar.stylex';

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
      if (!$isRangeSelection(selection)) return;

      if (newBlockType === 'bullet') {
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        return;
      }

      if (newBlockType === 'number') {
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        return;
      }

      // If currently in a list and converting to non-list, remove list first
      if (blockType === 'bullet' || blockType === 'number') {
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      }

      // Collect unique top-level elements to transform across the selection
      const elementsToTransform = new Set<ElementNode>();
      const nodes = selection.getNodes();
      for (const node of nodes) {
        const topLevel = node.getKey() === 'root' ? null : node.getTopLevelElement();
        if (topLevel && $isElementNode(topLevel)) {
          elementsToTransform.add(topLevel);
        }
      }

      // Fallback if getNodes() was empty or didn't match top level
      if (elementsToTransform.size === 0) {
        const anchorNode = selection.anchor.getNode();
        const topLevel = anchorNode.getKey() === 'root' ? null : anchorNode.getTopLevelElement();
        if (topLevel && $isElementNode(topLevel)) {
          elementsToTransform.add(topLevel);
        }
      }

      for (const element of elementsToTransform) {
        if (!element.isAttached()) continue;

        let newElement: ElementNode | null = null;
        if (newBlockType === 'paragraph') {
          newElement = $createParagraphNode();
        } else if (newBlockType.startsWith('h')) {
          newElement = $createHeadingNode(newBlockType as HeadingTagType);
        } else if (newBlockType === 'quote') {
          newElement = $createQuoteNode();
        } else if (newBlockType === 'code') {
          newElement = $createCodeNode();
        }

        if (newElement) {
          const children = element.getChildren();
          newElement.append(...children);
          element.replace(newElement);
        }
      }
    });

    editor.focus();
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
