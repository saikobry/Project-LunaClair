import {
  $createTextNode,
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
  isTableRowDivider,
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

// ── 1. Horizontal Rule Transformer ──
export const HR_TRANSFORMER: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node: LexicalNode) => {
    return $isHorizontalRuleNode(node) ? '---' : null;
  },
  regExp: /^(---|\*\*\*|___)\s?$/,
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
        const text = traverseChildren(cell).replace(/\n/g, ' ').trim();
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
  regExpStart: /^\|(.+)\|$/,
  regExpEnd: {
    optional: true,
    regExp: /^$/,
  },
  replace: (rootNode, _children, startMatch, _endMatch, linesInBetween) => {
    if (!linesInBetween && !startMatch) return false;

    const allLines = [startMatch[0], ...(linesInBetween || [])].filter((l) =>
      l.trim().startsWith('|'),
    );
    if (allLines.length < 2) return false;

    const contentLines: string[] = [];
    let hasDivider = false;
    for (const line of allLines) {
      if (isTableRowDivider(line)) {
        hasDivider = true;
      } else {
        contentLines.push(line);
      }
    }

    if (contentLines.length === 0) return false;

    const tableNode = $createTableNode();

    contentLines.forEach((line, rowIndex) => {
      const rowNode = $createTableRowNode();
      const cellTexts = line
        .split('|')
        .slice(1, -1)
        .map((t) => t.trim());

      cellTexts.forEach((text) => {
        const cellNode = $createTableCellNode(
          rowIndex === 0 && hasDivider
            ? TableCellHeaderStates.ROW
            : TableCellHeaderStates.NO_STATUS,
        );
        if (text) {
          cellNode.append($createTextNode(text));
        }
        rowNode.append(cellNode);
      });

      tableNode.append(rowNode);
    });

    rootNode.append(tableNode);
    return true;
  },
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
  HIGHLIGHT,
  INLINE_CODE,
  LINK,
];
