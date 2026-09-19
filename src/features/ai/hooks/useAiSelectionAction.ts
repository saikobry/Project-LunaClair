import { useEffect, useRef } from 'react';
import { buildSelectionActionPrompt, type AiSelectionAction } from '../utils/selectionActionPrompt';

/** A contextual action requested from a text selection in the reader. */
export interface AiSelectionRequest {
  text: string;
  action?: AiSelectionAction;
  sectionHeading?: string;
}

export interface AiSelectionSendOptions {
  documentContext?: { id: string; title?: string; markdown: string };
  selection: { text: string; surroundingHeading?: string };
}

export interface UseAiSelectionActionOptions {
  isOpen: boolean;
  materialId?: string;
  /** Raw study material markdown, attached so the answer stays grounded in the material. */
  documentContext?: string;
  selectionContext?: AiSelectionRequest | null;
  /** Dispatches the composed prompt. */
  send: (prompt: string, options: AiSelectionSendOptions) => void;
  /** Clears the pending selection once it has been dispatched. */
  onHandled?: () => void;
}

/**
 * Dispatches a reader selection action as a chat turn, exactly once.
 *
 * The reader hands the drawer a selection and expects it to be acted on, but the drawer is a
 * long-lived surface: re-rendering with the same context, or reopening it while one is still
 * attached, must not fire the request again. Deduplication is therefore by action + excerpt rather
 * than by object identity, since a new object with the same content is the same request.
 */
export function useAiSelectionAction({
  isOpen,
  materialId,
  documentContext,
  selectionContext,
  send,
  onHandled,
}: UseAiSelectionActionOptions): void {
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectionContext?.action || !isOpen) return;

    const key = `${selectionContext.action}:${selectionContext.text}`;
    if (handledRef.current === key) return;
    handledRef.current = key;

    send(buildSelectionActionPrompt(selectionContext.action, selectionContext.text), {
      documentContext: documentContext
        ? { id: materialId || 'current-doc', markdown: documentContext }
        : undefined,
      selection: {
        text: selectionContext.text,
        surroundingHeading: selectionContext.sectionHeading,
      },
    });
    onHandled?.();
  }, [selectionContext, isOpen, materialId, documentContext, send, onHandled]);
}
