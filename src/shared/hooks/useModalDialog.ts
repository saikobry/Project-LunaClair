import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  type RefObject,
} from 'react';
import { useBodyScrollLock } from './useBodyScrollLock';

interface UseModalDialogOptions {
  /** Whether the modal should be open. */
  isOpen: boolean;
  /**
   * Called when the backdrop itself is clicked. A native modal renders its
   * backdrop as a `::backdrop` pseudo-element, so the click is delivered on the
   * `<dialog>` element rather than a separate overlay node.
   */
  onBackdropClick?: () => void;
  /** Lock `document.body` scroll while open, restoring the previous value on close. */
  lockScroll?: boolean;
  /**
   * Additionally close on a document-level Escape keydown.
   *
   * A native modal already fires `cancel`, which consumers handle in JSX — this
   * is the belt-and-braces fallback for when `showModal()` did not take (or a
   * child consumes the keydown), matching the guarantee a hand-rolled
   * `role="dialog"` wrapper used to provide.
   */
  onEscape?: () => void;
}

/**
 * Native modal `<dialog>` plumbing: `showModal()` promotion, optional body
 * scroll locking, optional backdrop dismissal, and an optional Escape fallback.
 * Focus trapping, Escape via `cancel`, `::backdrop`, and top-layer stacking come
 * from the platform — attach the returned ref to the `<dialog>`.
 *
 * Callbacks are read through Effect Events: they are usually an inline parent
 * closure with a fresh identity every render, and reading them through an event
 * keeps the listeners from re-subscribing on unrelated parent redraws.
 *
 * Consumers keep owning their own dismiss semantics in JSX (`onCancel`), which
 * is why Escape-to-close is opt-in rather than assumed.
 */
export function useModalDialog({
  isOpen,
  onBackdropClick,
  lockScroll = false,
  onEscape,
}: UseModalDialogOptions): RefObject<HTMLDialogElement | null> {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Promote to the top layer during layout, so there is no un-modal frame.
  useLayoutEffect(() => {
    if (isOpen && !dialogRef.current?.open) {
      dialogRef.current?.showModal();
    }
  }, [isOpen]);

  useBodyScrollLock(isOpen && lockScroll);

  const hasBackdropHandler = onBackdropClick != null;
  const hasEscapeHandler = onEscape != null;

  const handleBackdrop = useEffectEvent(() => {
    onBackdropClick?.();
  });
  const handleEscape = useEffectEvent(() => {
    onEscape?.();
  });

  // Re-runs on `isOpen` (not on the callback identity) so the listener attaches
  // once the dialog actually mounts.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !hasBackdropHandler) return;
    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog) handleBackdrop();
    };
    dialog.addEventListener('click', handleClick);
    return () => dialog.removeEventListener('click', handleClick);
  }, [isOpen, hasBackdropHandler]);

  useEffect(() => {
    if (!isOpen || !hasEscapeHandler) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleEscape();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasEscapeHandler]);

  return dialogRef;
}
