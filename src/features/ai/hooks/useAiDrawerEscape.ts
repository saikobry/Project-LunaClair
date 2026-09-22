import { useEffect, useEffectEvent } from 'react';

export interface UseAiDrawerEscapeOptions {
  /** Whether the drawer is showing and should listen for Escape. */
  isOpen: boolean;
  /** True while the history panel covers the transcript: Escape closes it first. */
  isHistoryOpen: boolean;
  /** Closes only the history panel, leaving the drawer open. */
  onCloseHistory: () => void;
  /** Closes the drawer itself. */
  onClose: () => void;
}

/**
 * Escape dismissal for the AI chat drawer — the same document-level guarantee
 * `useModalDialog` hands the native-`<dialog>` surfaces (`AddMaterialsDrawer`),
 * hand-rolled because the drawer is a non-modal `<aside>` with a slide
 * animation and its own backdrop, not a `<dialog>` with a `cancel` event to
 * hang it on.
 *
 * One keypress peels one surface, in order: an open native dialog above the
 * drawer keeps it — `event.defaultPrevented` catches Astryx Dialog, which
 * `preventDefault()`s the keydown from its subtree before it reaches the
 * document, and `dialog[open]` catches a raw `<dialog>` whose `cancel` fires
 * as this same event's default action once dispatch completes — then the
 * history panel closes, then the drawer. Callbacks and history state are read
 * through the Effect Event, so the listener attaches once per open state and
 * never re-subscribes when the workspace passes a fresh inline `onClose` on
 * every render.
 */
export function useAiDrawerEscape({
  isOpen,
  isHistoryOpen,
  onCloseHistory,
  onClose,
}: UseAiDrawerEscapeOptions): void {
  const handleEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (document.querySelector('dialog[open]') !== null) return;
    if (isHistoryOpen) {
      onCloseHistory();
      return;
    }
    onClose();
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => handleEscape(event);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);
}
