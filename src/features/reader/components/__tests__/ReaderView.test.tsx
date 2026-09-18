import { createRef, type RefObject } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReaderView from '../ReaderView';
import { FocusModeProvider } from '../../../../app/providers/FocusModeContext';
import { getOffsetsOfRange, restoreRange } from '../../utils/selection';
import type { PopoverState } from '../../types/reader.types';

const CONTENT = '# Cell Biology\n\nMitochondria generate ATP.';

/**
 * The article's rendered text stream, with no annotation chrome in the scope.
 *
 * The `\n` between the heading and the paragraph is real: `rehypeRaw`
 * serializes the tree and reparses it, which keeps a whitespace text node
 * between block elements. Offsets are measured over this exact stream.
 */
const ARTICLE_TEXT = 'Cell Biology\nMitochondria generate ATP.';

beforeEach(() => {
  // Polyfill scrollTo / scrollIntoView in JSDOM (the outline widget scrolls its rail).
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

function renderView(
  popover: PopoverState,
  onAskAiSelection?: (action: 'explain' | 'simplify' | 'example', text: string) => void,
) {
  const containerRef = createRef<HTMLDivElement>();
  const utils = render(
    <FocusModeProvider isFocusMode={false}>
      <ReaderView
        content={CONTENT}
        containerRef={containerRef as RefObject<HTMLDivElement | null>}
        mode="select"
        onModeChange={vi.fn()}
        drawingTool="pen"
        onToolChange={vi.fn()}
        brushColor="#ef4444"
        onColorChange={vi.fn()}
        brushThickness={4}
        onThicknessChange={vi.fn()}
        onUndo={vi.fn()}
        onClearDrawings={vi.fn()}
        onClearHighlights={vi.fn()}
        hasDrawings={false}
        hasHighlights={false}
        paths={[]}
        onPathsChange={vi.fn()}
        popover={popover}
        onCreateHighlight={vi.fn()}
        onDeleteHighlight={vi.fn()}
        onClosePopover={vi.fn()}
        onAskAiSelection={onAskAiSelection}
      />
    </FocusModeProvider>,
  );
  return { containerRef, ...utils };
}

/** Locates the first text node containing `needle` inside a scope element. */
function findTextNode(root: HTMLElement, needle: string): { node: Text; index: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? '';
    const index = text.indexOf(needle);
    if (index >= 0) {
      return { node: node as Text, index };
    }
    node = walker.nextNode();
  }
  throw new Error(`Text "${needle}" not found in the offset scope.`);
}

/** Measures the stored offsets of the word "ATP" through the real offset walker. */
function measureAtpOffsets(containerRef: RefObject<HTMLDivElement | null>) {
  const scope = containerRef.current;
  expect(scope).not.toBeNull();
  const { node, index } = findTextNode(scope!, 'ATP');
  const range = document.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + 3);
  return getOffsetsOfRange(range, scope!);
}

describe('ReaderView — highlight offset scope', () => {
  it('measures offsets against the rendered article only, never the selection rail', () => {
    // Rail visible with the full action set: its Astryx tooltips inject hidden
    // text into the DOM ("Explain selected text" + "Simplify selected text" +
    // "Provide an example" + "Cancel") ahead of the article.
    const { containerRef, unmount } = renderView(
      {
        x: 0,
        y: 0,
        visible: true,
        pendingSelection: { start: 0, end: 3, text: 'ATP' },
      },
      vi.fn(),
    );

    // The rail really is mounted, and its Astryx tooltip copy sits in the document
    // (that copy is what the offset walkers used to count, ahead of the article,
    // shifting every stored offset by its length).
    expect(screen.getByText('Explain selected text')).toBeInTheDocument();
    expect(screen.getByLabelText('Highlight Yellow')).toBeInTheDocument();
    // …yet none of it is inside the offset scope.
    const withRailScope = containerRef.current!;
    expect(withRailScope.textContent).toBe(ARTICLE_TEXT);
    expect(measureAtpOffsets(containerRef)).toEqual({ start: 35, end: 38 });

    unmount();

    // Same offsets with the rail hidden — the rail's presence must not move them.
    const hidden = renderView({ x: 0, y: 0, visible: false });
    expect(hidden.containerRef.current!.textContent).toBe(ARTICLE_TEXT);
    expect(measureAtpOffsets(hidden.containerRef)).toEqual({ start: 35, end: 38 });
  });

  it('round-trips stored offsets back to the same text while the rail is visible', () => {
    const { containerRef } = renderView(
      {
        x: 0,
        y: 0,
        visible: true,
        targetHighlightId: 'hl-1',
        pendingSelection: { start: 35, end: 38, text: 'ATP' },
      },
      vi.fn(),
    );

    const range = restoreRange(containerRef.current!, 35, 38);
    expect(range?.toString()).toBe('ATP');
  });
});
