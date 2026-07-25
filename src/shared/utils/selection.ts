/**
 * Helper to compute character count of a DOM node (recursively summing text content lengths).
 */
function getCharCount(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.length || 0;
  }
  let count = 0;
  for (let i = 0; i < node.childNodes.length; i++) {
    count += getCharCount(node.childNodes[i]);
  }
  return count;
}

/**
 * Traverses a container's DOM nodes to find the start and end character offsets
 * of a given Range, ignoring HTML tags and layout nodes.
 */
export function getOffsetsOfRange(range: Range, container: HTMLElement) {
  let startOffset = 0;
  let endOffset = 0;
  let foundStart = false;
  let foundEnd = false;
  let charCount = 0;

  function traverse(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      if (!foundStart) {
        if (node === range.startContainer) {
          startOffset = charCount + range.startOffset;
          foundStart = true;
        }
      }
      if (!foundEnd) {
        if (node === range.endContainer) {
          endOffset = charCount + range.endOffset;
          foundEnd = true;
        }
      }
      charCount += len;
    } else {
      // If the node itself is the start/end container (which can happen when selecting entire elements)
      if (!foundStart && node === range.startContainer) {
        let childCharCount = 0;
        for (let i = 0; i < range.startOffset; i++) {
          childCharCount += getCharCount(node.childNodes[i]);
        }
        startOffset = charCount + childCharCount;
        foundStart = true;
      }
      if (!foundEnd && node === range.endContainer) {
        let childCharCount = 0;
        for (let i = 0; i < range.endOffset; i++) {
          childCharCount += getCharCount(node.childNodes[i]);
        }
        endOffset = charCount + childCharCount;
        foundEnd = true;
      }

      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
        if (foundStart && foundEnd) break;
      }
    }
  }

  traverse(container);

  if (foundStart && foundEnd) {
    return { start: startOffset, end: endOffset };
  }
  return null;
}

/**
 * Recreates a DOM Range within a container based on start and end character offsets.
 */
export function restoreRange(container: HTMLElement, startOffset: number, endOffset: number): Range | null {
  let startNode: Node | null = null;
  let startCharIndex = 0;
  let endNode: Node | null = null;
  let endCharIndex = 0;
  let charCount = 0;
  let foundStart = false;
  let foundEnd = false;

  function traverse(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      if (!foundStart && charCount + len >= startOffset) {
        startNode = node;
        startCharIndex = startOffset - charCount;
        foundStart = true;
      }
      if (!foundEnd && charCount + len >= endOffset) {
        endNode = node;
        endCharIndex = endOffset - charCount;
        foundEnd = true;
      }
      charCount += len;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
        if (foundStart && foundEnd) break;
      }
    }
  }

  traverse(container);

  if (startNode && endNode) {
    const range = document.createRange();
    range.setStart(startNode, startCharIndex);
    range.setEnd(endNode, endCharIndex);
    return range;
  }
  return null;
}
