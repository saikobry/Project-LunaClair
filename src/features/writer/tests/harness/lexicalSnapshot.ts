import {
  type LexicalEditor,
  type LexicalNode,
  type ElementNode,
  $isElementNode,
  $isTextNode,
  $getRoot,
} from 'lexical';
import { $isHeadingNode } from '@lexical/rich-text';
import { $isListNode, $isListItemNode } from '@lexical/list';
import { $isTableCellNode } from '@lexical/table';
import { $isLinkNode } from '@lexical/link';
import { $isCodeNode } from '@lexical/code';
import { $isHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { $isImageNode } from '../../nodes/ImageNode';

export interface SemanticASTNode {
  type: string;
  props?: Record<string, unknown>;
  text?: string;
  formats?: string[];
  children?: SemanticASTNode[];
}

/**
 * Recursively serializes a LexicalNode into a clean, testable Semantic AST structure.
 */
export function serializeNode(node: LexicalNode): SemanticASTNode {
  const type = node.getType();

  if ($isTextNode(node)) {
    const formats: string[] = [];
    if (node.hasFormat('bold')) formats.push('bold');
    if (node.hasFormat('italic')) formats.push('italic');
    if (node.hasFormat('underline')) formats.push('underline');
    if (node.hasFormat('strikethrough')) formats.push('strikethrough');
    if (node.hasFormat('code')) formats.push('code');
    if (node.hasFormat('highlight')) formats.push('highlight');

    return {
      type: 'text',
      text: node.getTextContent(),
      ...(formats.length > 0 ? { formats } : {}),
    };
  }

  if ($isImageNode(node)) {
    return {
      type: 'image',
      props: {
        src: node.getSrc(),
        altText: node.getAltText(),
      },
    };
  }

  if ($isHorizontalRuleNode(node)) {
    return {
      type: 'horizontal-rule',
    };
  }

  const props: Record<string, unknown> = {};

  if ($isHeadingNode(node)) {
    props.tag = node.getTag();
  } else if ($isListNode(node)) {
    props.listType = node.getListType();
    if (node.getListType() === 'number') {
      props.start = node.getStart();
    }
  } else if ($isListItemNode(node)) {
    props.indent = node.getIndent();
    const checked = node.getChecked();
    if (checked !== undefined) {
      props.checked = checked;
    }
  } else if ($isLinkNode(node)) {
    props.url = node.getURL();
  } else if ($isCodeNode(node)) {
    props.language = node.getLanguage();
  } else if ($isTableCellNode(node)) {
    props.headerState = node.getHeaderStyles();
  }

  const result: SemanticASTNode = {
    type,
    ...(Object.keys(props).length > 0 ? { props } : {}),
  };

  if ($isElementNode(node)) {
    const children = (node as ElementNode).getChildren();
    if (children.length > 0) {
      result.children = children.map(serializeNode);
    }
  }

  return result;
}

/**
 * Serializes an entire Lexical EditorState into a Semantic AST representation.
 */
export function serializeLexicalStructure(editor: LexicalEditor): SemanticASTNode {
  return editor.getEditorState().read(() => {
    const root = $getRoot();
    return serializeNode(root);
  });
}
