import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextSelection } from '../useTextSelection';
import type { HighlightItem } from '../../../../domain/reader/models/annotation.types';
import * as selectionUtils from '../../utils/selection';

describe('useTextSelection', () => {
  let containerElement: HTMLDivElement;
  let containerRef: { current: HTMLDivElement | null };

  const mockHighlights: HighlightItem[] = [
    {
      id: 'hl-1',
      start: 5,
      end: 15,
      color: 'yellow',
      text: 'highlighted',
    },
  ];

  beforeEach(() => {
    containerElement = document.createElement('div');
    containerElement.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 100,
      top: 50,
      width: 500,
      height: 300,
    });
    containerRef = { current: containerElement };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with hidden popover state', () => {
    const { result } = renderHook(() =>
      useTextSelection('select', mockHighlights, containerRef),
    );

    expect(result.current.popover).toEqual({
      x: 0,
      y: 0,
      visible: false,
    });
  });

  it('ignores selection events when mode is draw', () => {
    const { result } = renderHook(() =>
      useTextSelection('draw', mockHighlights, containerRef),
    );

    // Mock window selection
    const mockRange = {
      getBoundingClientRect: vi.fn().mockReturnValue({ left: 120, top: 70, width: 40 }),
    };
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'selected text',
      rangeCount: 1,
      getRangeAt: () => mockRange as any,
    } as any);

    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
    });

    expect(result.current.popover.visible).toBe(false);
  });

  it('shows pending selection popover when text range is selected in select mode', () => {
    vi.spyOn(selectionUtils, 'getOffsetsOfRange').mockReturnValue({
      start: 20,
      end: 35,
    });

    const mockRange = {
      getBoundingClientRect: vi.fn().mockReturnValue({ left: 150, top: 100, width: 80, height: 20 }),
    };

    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'important concept',
      rangeCount: 1,
      getRangeAt: () => mockRange as any,
    } as any);

    const { result } = renderHook(() =>
      useTextSelection('select', mockHighlights, containerRef),
    );

    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
    });

    expect(result.current.popover.visible).toBe(true);
    expect(result.current.popover.pendingSelection).toEqual({
      start: 20,
      end: 35,
      text: 'important concept',
    });
    // x = 150 + 40 - 100 = 90, y = 100 - 50 = 50
    expect(result.current.popover.x).toBe(90);
    expect(result.current.popover.y).toBe(50);
  });

  it('shows delete popover when cursor clicks inside an existing highlight', () => {
    vi.spyOn(selectionUtils, 'getOffsetsOfRange').mockReturnValue({
      start: 10,
      end: 10,
    });

    const mockRange = {
      getBoundingClientRect: vi.fn().mockReturnValue({ left: 140, top: 80, width: 0, height: 20 }),
    };

    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: true,
      toString: () => '',
      rangeCount: 1,
      getRangeAt: () => mockRange as any,
    } as any);

    const { result } = renderHook(() =>
      useTextSelection('select', mockHighlights, containerRef),
    );

    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
    });

    expect(result.current.popover.visible).toBe(true);
    expect(result.current.popover.targetHighlightId).toBe('hl-1');
  });

  it('cleans up selectionchange event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useTextSelection('select', mockHighlights, containerRef),
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'selectionchange',
      expect.any(Function),
    );
  });
});
