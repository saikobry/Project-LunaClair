import { useEffect, useRef } from 'react';
import { buildSelectionActionPrompt, type AiSelectionAction } from '../utils/selectionActionPrompt';
import type { AiMessageRecord } from '../../../domain/ai/models/ai.types';

/** A contextual action requested from a text selection in the reader. */
export interface AiSelectionRequest {
  text: string;
  action?: AiSelectionAction;
  sectionHeading?: string;
}

export interface AiSelectionSendOptions {
  selection: { text: string; surroundingHeading?: string };
  /**
   * Open a distinct session for this turn instead of continuing the active
   * one. The drawer's selection-thread preference drives it.
   */
  freshSession?: boolean;
}

export interface UseAiSelectionActionOptions {
  isOpen: boolean;
  /**
   * True once the thread state has settled (initial history load done).
   *
   * The drawer mounts with the selection already attached, so an undisciplined
   * dispatch races the resolving session: the send creates a thread the load
   * then overwrites, or a mount-time abort (StrictMode's unmount simulation in
   * dev) kills it mid-flight and orphans an empty "New chat". Waiting for the
   * session to settle means the turn lands on the resolved thread, once.
   */
  ready: boolean;
  selectionContext?: AiSelectionRequest | null;
  /** Turns currently on the transcript, used to confirm the dispatch landed. */
  messages: AiMessageRecord[];
  /**
   * Open a distinct session for the turn rather than continuing the active
   * one. Rides the send options through to `sendMessage` untouched.
   */
  forceNewThread?: boolean;
  /** Dispatches the composed prompt. */
  send: (prompt: string, options: AiSelectionSendOptions) => void;
  /**
   * Clears the pending selection once its turn is on the transcript.
   *
   * Clearing is confirmation-gated rather than fire-and-forget: a send that
   * dies before persisting (mount-time abort, pre-persist failure) leaves the
   * context attached, so a remount retries it on the resolved session instead
   * of stranding an empty thread nobody can reach.
   */
  onHandled?: () => void;
}

/**
 * Dispatches a reader selection action as a chat turn, exactly once per request.
 *
 * The reader hands the drawer a selection and expects it to be acted on, but the drawer is a
 * long-lived surface: re-rendering with the same context, or reopening it while one is still
 * attached, must not fire the request again. Deduplication is therefore by action + excerpt rather
 * than by object identity, since a new object with the same content is the same request. The key
 * resets once the context clears, so deliberately re-invoking the same action on the same text
 * sends again.
 */
export function useAiSelectionAction({
  isOpen,
  ready,
  selectionContext,
  messages,
  forceNewThread,
  send,
  onHandled,
}: UseAiSelectionActionOptions): void {
  const handledRef = useRef<{ key: string; prompt: string; countBefore: number } | null>(null);

  useEffect(() => {
    if (!selectionContext?.action || !isOpen || !ready) return;

    const key = `${selectionContext.action}:${selectionContext.text}`;
    if (handledRef.current?.key === key) return;

    const prompt = buildSelectionActionPrompt(selectionContext.action, selectionContext.text);
    const countBefore = messages.filter(
      (message) => message.role === 'user' && message.content === prompt,
    ).length;
    handledRef.current = { key, prompt, countBefore };
    send(prompt, {
      selection: {
        text: selectionContext.text,
        surroundingHeading: selectionContext.sectionHeading,
      },
      ...(forceNewThread ? { freshSession: true } : {}),
    });
  }, [selectionContext, isOpen, ready, forceNewThread, send, messages]);

  // The turn belongs to the transcript once its user record is on it — the
  // optimistic record counts, so a healthy send clears promptly.
  // Using count comparison prevents an older identical prompt in the same
  // conversation from immediately resolving a newly dispatched selection.
  useEffect(() => {
    const pending = handledRef.current;
    if (!pending) return;
    if (!selectionContext) {
      handledRef.current = null;
      return;
    }
    const countNow = messages.filter(
      (message) => message.role === 'user' && message.content === pending.prompt,
    ).length;
    if (countNow > pending.countBefore) {
      handledRef.current = null;
      onHandled?.();
    }
  }, [messages, selectionContext, onHandled]);
}
