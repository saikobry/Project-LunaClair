import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAiDrawerEscape } from '../useAiDrawerEscape';

function pressEscape() {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true }),
    );
  });
}

function renderEscape(props: {
  isOpen: boolean;
  isHistoryOpen?: boolean;
  onCloseHistory?: () => void;
  onClose: () => void;
}) {
  return renderHook(
    ({ isOpen, isHistoryOpen, onCloseHistory, onClose }) =>
      useAiDrawerEscape({ isOpen, isHistoryOpen, onCloseHistory, onClose }),
    {
      initialProps: {
        isOpen: props.isOpen,
        isHistoryOpen: props.isHistoryOpen ?? false,
        onCloseHistory: props.onCloseHistory ?? vi.fn(),
        onClose: props.onClose,
      },
    },
  );
}

describe('useAiDrawerEscape', () => {
  it('closes on Escape while open, and stops listening when closed', () => {
    const onClose = vi.fn();
    const { rerender } = renderEscape({ isOpen: true, onClose });

    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender({
      isOpen: false,
      isHistoryOpen: false,
      onCloseHistory: vi.fn(),
      onClose,
    });

    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the history panel before the drawer on successive presses', () => {
    const onClose = vi.fn();
    const onCloseHistory = vi.fn();
    renderEscape({ isOpen: true, isHistoryOpen: true, onCloseHistory, onClose });

    pressEscape();
    expect(onCloseHistory).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('leaves Escape to a native dialog layered above the drawer', () => {
    const onClose = vi.fn();
    renderEscape({ isOpen: true, onClose });

    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);

    pressEscape();
    expect(onClose).not.toHaveBeenCalled();

    dialog.remove();

    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores an Escape another surface already consumed', () => {
    const onClose = vi.fn();
    renderEscape({ isOpen: true, onClose });

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      event.preventDefault();
      document.dispatchEvent(event);
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
