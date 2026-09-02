import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraggableToolbar } from '../useDraggableToolbar';
import { STORAGE_KEYS } from '../../../../shared/constants/storageKeys';

describe('useDraggableToolbar', () => {
  let toolbarElement: HTMLDivElement;
  let toolbarRef: { current: HTMLDivElement | null };

  beforeEach(() => {
    localStorage.clear();
    toolbarElement = document.createElement('div');
    toolbarElement.setPointerCapture = vi.fn();
    toolbarElement.releasePointerCapture = vi.fn();
    Object.defineProperty(toolbarElement, 'offsetWidth', { value: 48, configurable: true });
    Object.defineProperty(toolbarElement, 'offsetHeight', { value: 200, configurable: true });
    toolbarElement.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 256,
      top: 100,
      width: 48,
      height: 200,
      right: 304,
      bottom: 300,
    });
    toolbarRef = { current: toolbarElement };

    // Set standard window dimensions for jsdom
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  });

  it('initializes with default position when localStorage is empty', () => {
    const { result } = renderHook(() => useDraggableToolbar(toolbarRef, false, false));

    expect(result.current.isDragging).toBe(false);
    const styles = result.current.getPositionStyles();
    expect(styles.left).toBe('256px'); // 240 (sidebar) + 16
    expect(styles.top).toBe('100px');
    expect(styles.cursor).toBe('grab');
  });

  it('restores persisted position from localStorage on mount', () => {
    localStorage.setItem(
      STORAGE_KEYS.reader.toolbarPosition,
      JSON.stringify({ side: 'right', y: 150 }),
    );

    const { result } = renderHook(() => useDraggableToolbar(toolbarRef, false, false));

    const styles = result.current.getPositionStyles();
    expect(styles.right).toBe('16px');
    expect(styles.left).toBe('auto');
    expect(styles.top).toBe('150px');
  });

  it('adjusts left position for Focus Mode (no sidebar offset)', () => {
    const { result } = renderHook(() => useDraggableToolbar(toolbarRef, false, true));

    const styles = result.current.getPositionStyles();
    expect(styles.left).toBe('16px');
  });

  it('returns empty position styles on mobile or tablet', () => {
    const { result } = renderHook(() => useDraggableToolbar(toolbarRef, true, false));

    expect(result.current.getPositionStyles()).toEqual({});
  });

  it('ignores drag initiation on mobile/tablet or non-primary mouse buttons', () => {
    const { result } = renderHook(() => useDraggableToolbar(toolbarRef, true, false));

    act(() => {
      result.current.handlePointerDown({
        button: 0,
        pointerId: 1,
        clientX: 260,
        clientY: 110,
        target: toolbarElement,
      } as any);
    });

    expect(result.current.isDragging).toBe(false);
  });

  it('ignores drag initiation when clicking on buttons or inputs', () => {
    const { result } = renderHook(() => useDraggableToolbar(toolbarRef, false, false));

    const button = document.createElement('button');
    toolbarElement.appendChild(button);

    act(() => {
      result.current.handlePointerDown({
        button: 0,
        pointerId: 1,
        clientX: 260,
        clientY: 110,
        target: button,
      } as any);
    });

    expect(result.current.isDragging).toBe(false);
    expect(toolbarElement.setPointerCapture).not.toHaveBeenCalled();
  });

  it('handles full drag lifecycle: down, move, up, and updates position and localStorage', () => {
    const { result } = renderHook(() => useDraggableToolbar(toolbarRef, false, false));

    // Pointer down
    act(() => {
      result.current.handlePointerDown({
        button: 0,
        pointerId: 1,
        clientX: 260,
        clientY: 110,
        target: toolbarElement,
      } as any);
    });

    expect(result.current.isDragging).toBe(true);
    expect(toolbarElement.setPointerCapture).toHaveBeenCalledWith(1);

    // Pointer move to the right side of the screen
    act(() => {
      result.current.handlePointerMove({
        clientX: 1000,
        clientY: 300,
      } as any);
    });

    const draggingStyles = result.current.getPositionStyles();
    expect(draggingStyles.cursor).toBe('grabbing');
    expect(draggingStyles.left).toBeDefined();
    expect(draggingStyles.top).toBeDefined();

    // Pointer up
    act(() => {
      result.current.handlePointerUp({
        pointerId: 1,
      } as any);
    });

    expect(result.current.isDragging).toBe(false);
    expect(toolbarElement.releasePointerCapture).toHaveBeenCalledWith(1);

    // Should have snapped to right side since clientX 1000 is on right half of 1200
    const finalStyles = result.current.getPositionStyles();
    expect(finalStyles.right).toBe('16px');
    expect(finalStyles.left).toBe('auto');

    // Persisted to localStorage
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.reader.toolbarPosition)!);
    expect(stored.side).toBe('right');
    expect(typeof stored.y).toBe('number');
  });
});
