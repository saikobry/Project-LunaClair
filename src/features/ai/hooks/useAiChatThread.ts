import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  ApplicationContext,
  type ApplicationContextValue,
} from '../../../app/providers/ApplicationContext';
import type {
  AiMessageRecord,
  AiThread,
} from '../../../domain/ai/models/ai.types';
import {
  AI_ACTIVITY_TICK_MS,
  AI_FIRST_TOKEN_TIMEOUT_MS,
  resolveAiActivity,
  type AiActivityState,
} from '../utils/aiActivity';
import { deriveSessionTitle } from '../utils/deriveSessionTitle';
import { resolveCooldownSeconds } from '../utils/aiRateLimit';

export interface UseAiChatThreadOptions {
  /** Optional study material ID. If undefined, operates on the global assistant. */
  materialId?: string;
  /** Study material document content for context grounding. */
  documentContext?: {
    id: string;
    title?: string;
    markdown: string;
  };
  /** Text selection context. */
  selection?: {
    text: string;
    surroundingHeading?: string;
    source?: string;
  };
  /**
   * How long a turn may go without producing its first token before the request
   * is abandoned. Defaults to {@link AI_FIRST_TOKEN_TIMEOUT_MS}.
   */
  firstTokenTimeoutMs?: number;
  /**
   * App-facing model id for the next request. Omitted = the Worker's catalog default.
   *
   * Read at send time, so switching models affects the next message and never the turn already
   * streaming; retries reuse it because they go through the same options.
   */
  model?: string;
}

export interface AiChatError {
  code: string;
  message: string;
  /** Present when the provider named a wait — a rate limit, typically. */
  retryAfterSeconds?: number;
}

export interface UseAiChatThreadResult {
  /** Active session, or null before one exists. */
  thread: AiThread | null;
  /** Every session in scope, newest first. */
  sessions: AiThread[];
  messages: AiMessageRecord[];
  isLoading: boolean;
  isStreaming: boolean;
  /**
   * Live wait state while the assistant has produced no text yet — rotating
   * label with elapsed time and a stall flag. Null once tokens arrive, because
   * real output is its own feedback.
   */
  activity: AiActivityState | null;
  streamingText: string;
  streamingMessageId: string | null;
  error: AiChatError | null;
  sendMessage: (content: string, overrideOptions?: Partial<UseAiChatThreadOptions>) => Promise<void>;
  abort: () => void;
  stopStreaming: () => void;
  retryMessage: (messageId: string) => Promise<void>;
  /** Re-sends the most recent user prompt (used when a request failed before a turn was persisted). */
  retryLastPrompt: () => Promise<void>;
  /**
   * Seconds until sending is allowed after a rate limit; 0 when ready.
   *
   * A shared-capacity model refuses on its own schedule, so the composer holds off until the wait
   * the provider named has passed instead of spending a request on a refusal.
   */
  cooldownSeconds: number;
  /** Clears the current request-level error without retrying. */
  dismissError: () => void;
  /** Deletes every session in scope. */
  clearHistory: () => Promise<void>;
  /** Starts an empty session. Nothing is written until the first prompt is sent. */
  startNewSession: () => void;
  selectSession: (threadId: string) => void;
  deleteSession: (threadId: string) => Promise<void>;
  reloadMessages: () => Promise<void>;
}

/**
 * Which session the drawer is showing.
 *
 * `resolve` reopens the newest session in scope on mount, `draft` is an unsaved
 * new session, and `thread` is a specific session chosen from history.
 */
type SessionSelection =
  | { kind: 'resolve' }
  | { kind: 'draft' }
  | { kind: 'thread'; threadId: string };

/**
 * Reads the session list for a scope, returning null when the store is
 * unavailable or the read fails. Session history is a convenience surface, so
 * a failed read keeps the last known list rather than throwing.
 */
async function readSessionList(
  context: ApplicationContextValue | null,
  materialId?: string,
): Promise<AiThread[] | null> {
  if (!context?.repositories?.aiChat) return null;
  try {
    return await context.repositories.aiChat.listThreads(materialId);
  } catch {
    return null;
  }
}

/**
 * Feature hook for local-first AI chat sessions.
 *
 * Owns the session lifecycle (reopen latest, start a new one, switch, delete),
 * loads turns from Dexie, coordinates real-time streaming, and keeps the
 * waiting indicator honest: a request that produces no token within
 * {@link AI_FIRST_TOKEN_TIMEOUT_MS} is abandoned with a retryable error instead
 * of leaving the user staring at a silent drawer.
 */
export function useAiChatThread(options: UseAiChatThreadOptions = {}): UseAiChatThreadResult {
  const context = useContext(ApplicationContext);
  const materialId = options.materialId;
  const firstTokenTimeoutMs = options.firstTokenTimeoutMs ?? AI_FIRST_TOKEN_TIMEOUT_MS;

  const [selection, setSelection] = useState<SessionSelection>({ kind: 'resolve' });
  const [thread, setThread] = useState<AiThread | null>(null);
  const [sessions, setSessions] = useState<AiThread[]>([]);
  const [messages, setMessages] = useState<AiMessageRecord[]>([]);
  // Derived from the DI context rather than flipped inside an effect: without
  // AI use cases there is nothing to load, so the composer must not stay gated.
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(context?.useCases?.ai));
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [activity, setActivity] = useState<AiActivityState | null>(null);
  const [error, setError] = useState<AiChatError | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  /** Mirrors `cooldownUntil` for `sendMessage`, which must not close over stale state. */
  const cooldownUntilRef = useRef<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  /** Identifies the in-flight turn so a superseded stream cannot clobber newer state. */
  const streamSeqRef = useRef(0);
  const streamStartedAtRef = useRef(0);
  const firstTokenRef = useRef(false);
  const previousMaterialIdRef = useRef(materialId);

  /**
   * Starts a cooldown from the wait a provider named.
   *
   * Both the displayed seconds and the absolute deadline are set here, in the caller's event
   * handler, rather than derived inside an effect — the countdown is computed from the deadline so a
   * backgrounded tab that misses ticks still resumes at the right remaining time instead of drifting.
   */
  const startCooldown = useCallback((retryAfterSeconds?: number) => {
    const seconds = resolveCooldownSeconds(retryAfterSeconds);
    const until = Date.now() + seconds * 1_000;
    cooldownUntilRef.current = until;
    setCooldownUntil(until);
    setCooldownSeconds(seconds);
  }, []);

  useEffect(() => {
    if (cooldownUntil === null) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (remaining === 0) {
        cooldownUntilRef.current = null;
        setCooldownUntil(null);
      }
    };

    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
    setActivity(null);
  }, []);

  const refreshSessions = useCallback(async () => {
    const list = await readSessionList(context, materialId);
    if (list) setSessions(list);
  }, [context, materialId]);

  /**
   * A material swap must not leave a session from the previous material on
   * screen — the drawer is a long-lived surface across navigation.
   */
  useEffect(() => {
    if (previousMaterialIdRef.current !== materialId) {
      previousMaterialIdRef.current = materialId;
      setSelection({ kind: 'resolve' });
    }
  }, [materialId]);

  useEffect(() => {
    const app = context;
    if (!app?.useCases?.ai) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        // Session history is scope-level, independent of which session loads.
        const sessionList = await readSessionList(app, materialId);
        if (!cancelled && sessionList) setSessions(sessionList);

        if (selection.kind === 'draft') {
          if (cancelled) return;
          setThread(null);
          setMessages([]);
          return;
        }

        if (selection.kind === 'thread') {
          const existing = await app.repositories.aiChat.getThread(selection.threadId);
          if (cancelled) return;
          setThread(existing);

          const history = await app.useCases.ai.getThreadMessages.execute({
            threadId: selection.threadId,
          });
          if (cancelled) return;
          setMessages(history);
          return;
        }

        // `resolve`: recover turns abandoned mid-stream, then reopen the newest
        // session. Never creates one — an unused material shows the empty state
        // rather than a phantom row in history.
        const resolved = await app.useCases.ai.resolveThread.execute({ materialId });
        if (cancelled) return;
        setThread(resolved.thread);

        const history = resolved.thread
          ? await app.useCases.ai.getThreadMessages.execute({ threadId: resolved.thread.id })
          : [];
        if (cancelled) return;
        setMessages(history);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load chat history';
        setError({ code: 'LOAD_ERROR', message });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      abort();
    };
  }, [context, materialId, selection, abort]);

  /**
   * First-token watchdog. Runs only while nothing has been rendered, so a long
   * answer is never cut off — only a request that has produced no text at all.
   */
  useEffect(() => {
    // Activity is only ever non-null while a turn is in flight — every path that
    // ends streaming clears it — so there is nothing to reset on the way out.
    if (!isStreaming) return;

    const tick = () => {
      if (firstTokenRef.current) return;

      const elapsed = Date.now() - streamStartedAtRef.current;

      if (elapsed >= firstTokenTimeoutMs) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setIsStreaming(false);
        setActivity(null);
        setError({
          code: 'TIMEOUT',
          message: 'The assistant did not start responding in time. Please try again.',
        });
        return;
      }

      setActivity(resolveAiActivity(elapsed));
    };

    tick();
    const interval = window.setInterval(tick, AI_ACTIVITY_TICK_MS);
    return () => window.clearInterval(interval);
  }, [isStreaming, firstTokenTimeoutMs]);

  const reloadMessages = useCallback(async () => {
    if (!thread || !context?.useCases?.ai) return;
    const history = await context.useCases.ai.getThreadMessages.execute({ threadId: thread.id });
    setMessages(history);
  }, [context, thread]);

  const startNewSession = useCallback(() => {
    abort();
    setError(null);
    setStreamingText('');
    setStreamingMessageId(null);
    // Clear the active session synchronously. The draft branch of the load
    // effect is async, so relying on it alone would let a prompt sent right
    // after "New chat" land in the conversation the user just left.
    setThread(null);
    setMessages([]);
    setSelection({ kind: 'draft' });
  }, [abort]);

  const selectSession = useCallback(
    (threadId: string) => {
      abort();
      setError(null);
      // Point the active session at the selection immediately, for the same
      // reason as `startNewSession`: a turn must never be appended to the
      // conversation the user has already switched away from.
      setThread(sessions.find((session) => session.id === threadId) ?? null);
      setMessages([]);
      setSelection({ kind: 'thread', threadId });
    },
    [abort, sessions],
  );

  const deleteSession = useCallback(
    async (threadId: string) => {
      if (!context?.useCases?.ai) return;
      abort();

      await context.useCases.ai.deleteThread.execute({ threadId });

      // Deleting the open session hands the drawer to the next newest one.
      if (thread?.id === threadId) {
        const resolved = await context.useCases.ai.resolveThread.execute({ materialId });
        setSelection(
          resolved.thread ? { kind: 'thread', threadId: resolved.thread.id } : { kind: 'draft' },
        );
      }

      await refreshSessions();
    },
    [context, thread, materialId, abort, refreshSessions],
  );

  const clearHistory = useCallback(async () => {
    if (!context?.useCases?.ai) return;
    abort();
    await context.useCases.ai.clearChatHistory.execute({ materialId });
    setError(null);
    setSelection({ kind: 'draft' });
    await refreshSessions();
  }, [context, materialId, abort, refreshSessions]);

  const sendMessage = useCallback(
    async (content: string, overrideOptions: Partial<UseAiChatThreadOptions> = {}) => {
      if (!context?.useCases?.ai) {
        setError({
          code: 'CONTEXT_ERROR',
          message: 'AI use cases not available in ApplicationContext.',
        });
        return;
      }

      const trimmed = content.trim();
      if (!trimmed) return;

      // A shared-capacity model refuses on its own schedule; retrying before the wait it named has
      // passed would spend the request on another refusal. Retries route through here too, so the
      // guard also covers "Retry" on the error banner.
      const remainingCooldown = cooldownUntilRef.current;
      if (remainingCooldown !== null && Date.now() < remainingCooldown) {
        setError({
          code: 'RATE_LIMITED',
          message: `Shared capacity is busy. Try again in ${Math.ceil((remainingCooldown - Date.now()) / 1000)}s.`,
        });
        return;
      }

      abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const seq = streamSeqRef.current + 1;
      streamSeqRef.current = seq;

      const isFirstTurn = messages.length === 0;

      let activeThread = thread;
      if (!activeThread) {
        try {
          activeThread = await context.useCases.ai.createThread.execute({ materialId });
        } catch (err: unknown) {
          if (streamSeqRef.current !== seq) return;
          const message = err instanceof Error ? err.message : 'Failed to start a chat session';
          setError({ code: 'THREAD_ERROR', message });
          setIsStreaming(false);
          return;
        }
        if (streamSeqRef.current !== seq) return;
        setThread(activeThread);
      }

      const userMessageRecord: AiMessageRecord = {
        id: `user-${crypto.randomUUID()}`,
        threadId: activeThread.id,
        role: 'user',
        content: trimmed,
        status: 'complete',
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessageRecord]);
      setIsStreaming(true);
      setStreamingText('');
      setStreamingMessageId(null);
      setError(null);
      firstTokenRef.current = false;
      streamStartedAtRef.current = Date.now();
      setActivity(resolveAiActivity(0));

      // Name the session from its first prompt so history is identifiable
      // instead of a wall of identical "New chat" rows. A failed rename must
      // never break the conversation, so it is fire-and-forget.
      if (isFirstTurn) {
        const title = deriveSessionTitle(trimmed);
        if (title) {
          void context.useCases.ai.renameThread
            .execute({ threadId: activeThread.id, title })
            .then(() => refreshSessions())
            .catch(() => undefined);
        }
      }

      const mergedDocContext = overrideOptions.documentContext ?? options.documentContext;
      const mergedSelection = overrideOptions.selection ?? options.selection;
      const mergedModel = overrideOptions.model ?? options.model;

      const chatMessagesPayload = [
        ...messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
        {
          id: userMessageRecord.id,
          role: userMessageRecord.role,
          content: userMessageRecord.content,
          createdAt: userMessageRecord.createdAt,
        },
      ];

      let accumulated = '';
      let hadStreamErrorEvent = false;

      try {
        const stream = context.useCases.ai.sendChatMessage.execute({
          threadId: activeThread.id,
          messages: chatMessagesPayload,
          document: mergedDocContext,
          selection: mergedSelection,
          model: mergedModel,
          signal: controller.signal,
        });

        for await (const event of stream) {
          if (controller.signal.aborted) break;

          switch (event.type) {
            case 'start':
              setStreamingMessageId(event.messageId);
              break;
            case 'token':
              if (!firstTokenRef.current) {
                firstTokenRef.current = true;
                setActivity(null);
              }
              accumulated += event.text;
              setStreamingText(accumulated);
              break;
            case 'done':
              break;
            case 'error':
              hadStreamErrorEvent = true;
              setError({
                code: event.code,
                message: event.message,
                ...(event.retryAfterSeconds !== undefined
                  ? { retryAfterSeconds: event.retryAfterSeconds }
                  : {}),
              });
              if (event.code === 'RATE_LIMITED') {
                startCooldown(event.retryAfterSeconds);
              }
              break;
          }
        }
        // A turn that produced no text and reported no error is a dead end the user cannot tell
        // apart from a hang: the pending bubble vanishes and nothing replaces it, because the use
        // case persists nothing for an empty completion. Surface it as retryable instead of silent.
        // An abort is excluded — the user ended that request deliberately.
        if (!hadStreamErrorEvent && !accumulated && !controller.signal.aborted) {
          setError({
            code: 'EMPTY_RESPONSE',
            message: 'The assistant returned an empty response. Please try again.',
          });
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted && streamSeqRef.current === seq) {
          const message = err instanceof Error ? err.message : 'Unknown streaming error';
          setError({ code: 'UNHANDLED_ERROR', message });
        }
      } finally {
        // A superseded stream must not reset the state of the one that replaced it.
        if (streamSeqRef.current === seq) {
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
          setIsStreaming(false);
          setStreamingText('');
          setStreamingMessageId(null);
          setActivity(null);

          // Synchronize persisted turns from Dexie. Skipped when aborted: an
          // interrupted turn is intentionally left to the recovery path.
          if (!controller.signal.aborted) {
            try {
              const refreshed = await context.useCases.ai.getThreadMessages.execute({
                threadId: activeThread.id,
              });
              setMessages(refreshed);

              // A stream error is persisted as its own turn, so the inline card
              // carries it; only failures with no persisted turn need the banner.
              if (hadStreamErrorEvent) setError(null);
            } catch {
              // The streamed answer is already on screen; a failed history resync
              // must not turn a successful turn into an unhandled rejection.
            }
          }

          void refreshSessions();
        }
      }
    },
    [context, thread, materialId, options, messages, abort, refreshSessions, startCooldown],
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;
      const priorUserMessages = messages.slice(0, msgIndex).filter((m) => m.role === 'user');
      const targetMessage = priorUserMessages[priorUserMessages.length - 1];
      if (targetMessage) {
        await sendMessage(targetMessage.content);
      }
    },
    [messages, sendMessage],
  );

  const retryLastPrompt = useCallback(async () => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      await sendMessage(lastUserMessage.content);
    }
  }, [messages, sendMessage]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    thread,
    sessions,
    messages,
    isLoading,
    isStreaming,
    activity,
    streamingText,
    streamingMessageId,
    error,
    cooldownSeconds,
    sendMessage,
    abort,
    stopStreaming: abort,
    retryMessage,
    retryLastPrompt,
    dismissError,
    clearHistory,
    startNewSession,
    selectSession,
    deleteSession,
    reloadMessages,
  };
}
