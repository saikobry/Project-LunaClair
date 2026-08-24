import {
  $createTextNode,
  $isTextNode,
  TextNode,
  type ElementNode,
  type LexicalNode,
} from 'lexical';
import {
  $createListNode,
  $createListItemNode,
  $isListNode,
  $isListItemNode,
  ListNode,
  ListItemNode,
} from '@lexical/list';
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { $isHeadingNode } from '@lexical/rich-text';
import {
  HorizontalRuleNode,
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
} from '@lexical/react/LexicalHorizontalRuleNode';
import {
  type ElementTransformer,
  type MultilineElementTransformer,
  type TextMatchTransformer,
  type Transformer,
  $generateNodesFromMarkdownString,
  HEADING,
  QUOTE,
  CODE,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  STRIKETHROUGH,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  HIGHLIGHT,
  INLINE_CODE,
  LINK,
  CHECK_LIST,
} from '@lexical/markdown';
import { ImageNode, $createImageNode, $isImageNode } from '../nodes/ImageNode';

export const UNDERLINE_TRANSFORMER: TextMatchTransformer = {
  dependencies: [TextNode],
  export: (node: LexicalNode) => {
    if (!$isTextNode(node) || !node.hasFormat('underline')) {
      return null;
    }

    let inner = node.getTextContent();
    if (node.hasFormat('bold')) {
      inner = `**${inner}**`;
    }
    if (node.hasFormat('italic')) {
      inner = `*${inner}*`;
    }
    if (node.hasFormat('strikethrough')) {
      inner = `~~${inner}~~`;
    }
    if (node.hasFormat('code')) {
      inner = `\`${inner}\``;
    }
    return `<u>${inner}</u>`;
  },
  importRegExp: /<u>([\s\S]*?)<\/u>/,
  regExp: /<u>([\s\S]*?)<\/u>$/,
  replace: (textNode: TextNode, match: RegExpMatchArray) => {
    const [, underlineText] = match;
    textNode.setTextContent(underlineText);
    if (!textNode.hasFormat('underline')) {
      textNode.toggleFormat('underline');
    }
    return textNode;
  },
  trigger: '>',
  type: 'text-match',
};

const TABLE_CELL_INLINE_TRANSFORMERS: Transformer[] = [
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  STRIKETHROUGH,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  UNDERLINE_TRANSFORMER,
  HIGHLIGHT,
  INLINE_CODE,
  LINK,
];

function $appendMarkdownToCell(cellNode: TableCellNode, text: string) {
  if (!text) return;
  try {
    const nodes = $generateNodesFromMarkdownString(text, TABLE_CELL_INLINE_TRANSFORMERS);
    if (nodes.length === 0) {
      cellNode.append($createTextNode(text));
      return;
    }
    for (const node of nodes) {
      if (node.getType() === 'paragraph') {
        const children = (node as ElementNode).getChildren();
        cellNode.append(...children);
      } else {
        cellNode.append(node);
      }
    }
  } catch {
    cellNode.append($createTextNode(text));
  }
}

// ── 1. Horizontal Rule Transformer ──
export const HR_TRANSFORMER: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node: LexicalNode) => {
    return $isHorizontalRuleNode(node) ? '---' : null;
  },
  regExp: /^(---|\*\*\*|___)\s*$/,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createHorizontalRuleNode();
    if (isImport) {
      parentNode.replace(line);
    } else {
      parentNode.insertBefore(line);
    }
  },
  type: 'element',
};

export function isTableRowDivider(line: string): boolean {
  const trimmed = line.trim();
  return /^\|?(\s*:?-+:?\s*\|?)+$/.test(trimmed) && trimmed.includes('-');
}

export function splitTableCells(line: string): string[] {
  const trimmed = line.trim();
  const content =
    trimmed.startsWith('|') && trimmed.endsWith('|')
      ? trimmed.slice(1, -1)
      : trimmed;

  const cells: string[] = [];
  let current = '';
  let isEscaped = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (isEscaped) {
      current += char;
      isEscaped = false;
    } else if (char === '\\') {
      isEscaped = true;
      current += char;
    } else if (char === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function escapeTableCellText(text: string): string {
  return text.replace(/\\\|/g, '___ESCAPED_PIPE___').replace(/\|/g, '\\|').replace(/___ESCAPED_PIPE___/g, '\\|');
}

// ── 2. Table Transformer (GFM tables) ──
export const TABLE_TRANSFORMER: MultilineElementTransformer = {
  dependencies: [TableNode, TableRowNode, TableCellNode],
  export: (node: LexicalNode, traverseChildren: (node: ElementNode) => string) => {
    if (!$isTableNode(node)) return null;

    const output: string[] = [];
    const rows = node.getChildren();
    let isFirstRow = true;
    let colCount = 0;

    for (const row of rows) {
      if (!$isTableRowNode(row)) continue;
      const cells = row.getChildren();
      const rowCells: string[] = [];
      for (const cell of cells) {
        if (!$isTableCellNode(cell)) continue;
        const text = escapeTableCellText(traverseChildren(cell).replace(/\n/g, ' ').trim());
        rowCells.push(text);
      }
      if (isFirstRow) {
        colCount = rowCells.length;
        output.push(`| ${rowCells.join(' | ')} |`);
        output.push(`| ${new Array(colCount).fill('---').join(' | ')} |`);
        isFirstRow = false;
      } else {
        output.push(`| ${rowCells.join(' | ')} |`);
      }
    }

    return output.join('\n');
  },
  handleImportAfterStartMatch: ({ lines, rootNode, startLineIndex }) => {
    const allLines: string[] = [lines[startLineIndex].trim()];
    let endLineIndex = startLineIndex;
    while (endLineIndex + 1 < lines.length && lines[endLineIndex + 1].trim().startsWith('|')) {
      endLineIndex++;
      allLines.push(lines[endLineIndex].trim());
    }

    if (allLines.length < 2) return null;

    const contentLines: string[] = [];
    let hasDivider = false;
    for (const line of allLines) {
      if (isTableRowDivider(line)) {
        hasDivider = true;
      } else {
        contentLines.push(line);
      }
    }

    if (!hasDivider || contentLines.length === 0) return null;

    const tableNode = $createTableNode();

    contentLines.forEach((line, rowIndex) => {
      const rowNode = $createTableRowNode();
      const cellTexts = splitTableCells(line);

      cellTexts.forEach((text) => {
        const cellNode = $createTableCellNode(
          rowIndex === 0 && hasDivider
            ? TableCellHeaderStates.ROW
            : TableCellHeaderStates.NO_STATUS,
        );
        if (text) {
          $appendMarkdownToCell(cellNode, text);
        }
        rowNode.append(cellNode);
      });

      tableNode.append(rowNode);
    });

    rootNode.append(tableNode);
    return [true, endLineIndex];
  },
  regExpStart: /^\|(.+)\|\s*$/,
  replace: () => false,
  type: 'multiline-element',
};

// ── 3. Image Transformer ──
export const IMAGE_TRANSFORMER: TextMatchTransformer = {
  dependencies: [ImageNode],
  export: (node: LexicalNode) => {
    if (!$isImageNode(node)) return null;
    return `![${node.getAltText()}](${node.getSrc()})`;
  },
  importRegExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))/,
  regExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))$/,
  replace: (textNode, match) => {
    const [, altText, src] = match;
    const imageNode = $createImageNode(src, altText);
    textNode.replace(imageNode);
  },
  trigger: ')',
  type: 'text-match',
};

// ── 4. Enhanced Multi-Level List Indentation (2-space / 4-space / Tab support) ──
function getListIndent(whitespaces: string): number {
  if (!whitespaces) return 0;
  const tabs = (whitespaces.match(/\t/g) || []).length;
  const spaces = whitespaces.replace(/\t/g, '').length;
  // Support standard 2-space or 4-space markdown indent
  return tabs + Math.floor(spaces / 2);
}

const $enhancedListExport = (
  listNode: ListNode,
  exportChildren: (node: ElementNode) => string,
  depth = 0,
): string => {
  const output: string[] = [];
  const children = listNode.getChildren();
  let index = 0;
  for (const listItemNode of children) {
    if ($isListItemNode(listItemNode)) {
      if (listItemNode.getChildrenSize() === 1) {
        const firstChild = listItemNode.getFirstChild();
        if ($isListNode(firstChild)) {
          const nestedResult = $enhancedListExport(
            firstChild,
            exportChildren,
            depth + 1,
          );
          if (nestedResult) {
            output.push(nestedResult);
          }
          continue;
        }
      }
      const indentLevel = listItemNode.getIndent() || depth;
      const indent = '  '.repeat(indentLevel);
      const listType = listNode.getListType();
      const prefix = listType === 'number' ? `${listNode.getStart() + index}. ` : '- ';
      const childrenText = exportChildren(listItemNode);
      output.push(indent + prefix + childrenText);
      index++;
    }
  }
  return output.join('\n');
};

export const ENHANCED_UNORDERED_LIST: ElementTransformer = {
  dependencies: [ListNode, ListItemNode],
  export: (node, exportChildren) => {
    return $isListNode(node) && node.getListType() === 'bullet'
      ? $enhancedListExport(node, exportChildren, 0)
      : null;
  },
  regExp: /^(\s*)[-*+]\s/,
  replace: (parentNode, children, match, isImport) => {
    if ($isHeadingNode(parentNode)) return false;
    const previousNode = parentNode.getPreviousSibling();
    const nextNode = parentNode.getNextSibling();
    const listItem = $createListItemNode();

    if ($isListNode(nextNode) && nextNode.getListType() === 'bullet') {
      const firstChild = nextNode.getFirstChild();
      if (firstChild !== null) {
        firstChild.insertBefore(listItem);
      } else {
        nextNode.append(listItem);
      }
      parentNode.remove();
    } else if ($isListNode(previousNode) && previousNode.getListType() === 'bullet') {
      previousNode.append(listItem);
      parentNode.remove();
    } else {
      const list = $createListNode('bullet');
      list.append(listItem);
      parentNode.replace(list);
    }
    listItem.append(...children);
    if (!isImport) {
      listItem.select(0, 0);
    }
    const indent = getListIndent(match[1]);
    if (indent) {
      listItem.setIndent(indent);
    }
  },
  triggerOnEnter: true,
  type: 'element',
};

export const ENHANCED_ORDERED_LIST: ElementTransformer = {
  dependencies: [ListNode, ListItemNode],
  export: (node, exportChildren) => {
    return $isListNode(node) && node.getListType() === 'number'
      ? $enhancedListExport(node, exportChildren, 0)
      : null;
  },
  regExp: /^(\s*)(\d+)\.\s/,
  replace: (parentNode, children, match, isImport) => {
    if ($isHeadingNode(parentNode)) return false;
    const previousNode = parentNode.getPreviousSibling();
    const nextNode = parentNode.getNextSibling();
    const listItem = $createListItemNode();

    if ($isListNode(nextNode) && nextNode.getListType() === 'number') {
      const firstChild = nextNode.getFirstChild();
      if (firstChild !== null) {
        firstChild.insertBefore(listItem);
      } else {
        nextNode.append(listItem);
      }
      nextNode.setStart(Number(match[2]));
      parentNode.remove();
    } else if ($isListNode(previousNode) && previousNode.getListType() === 'number') {
      previousNode.append(listItem);
      parentNode.remove();
    } else {
      const list = $createListNode('number', Number(match[2]));
      list.append(listItem);
      parentNode.replace(list);
    }
    listItem.append(...children);
    if (!isImport) {
      listItem.select(0, 0);
    }
    const indent = getListIndent(match[1]);
    if (indent) {
      listItem.setIndent(indent);
    }
  },
  triggerOnEnter: true,
  type: 'element',
};

/**
 * LunaClair standard markdown transformer suite.
 */
export const standardTransformers: Transformer[] = [
  HR_TRANSFORMER,
  TABLE_TRANSFORMER,
  IMAGE_TRANSFORMER,
  HEADING,
  QUOTE,
  CODE,
  ENHANCED_UNORDERED_LIST,
  ENHANCED_ORDERED_LIST,
  CHECK_LIST,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  STRIKETHROUGH,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  UNDERLINE_TRANSFORMER,
  HIGHLIGHT,
  INLINE_CODE,
  LINK,
];
