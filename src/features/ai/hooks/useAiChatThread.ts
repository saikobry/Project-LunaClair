import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import type {
  AiMessageRecord,
  AiThread,
  AiTutorMode,
  AiUsage,
} from '../../../domain/ai/ai.types';

export interface UseAiChatThreadOptions {
  /** Optional study material ID. If undefined, operates on the global assistant thread. */
  materialId?: string;
  /** AI interaction mode. Defaults to 'assistant'. */
  mode?: AiTutorMode;
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
}

export interface UseAiChatThreadResult {
  thread: AiThread | null;
  messages: AiMessageRecord[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  streamingText: string;
  error: { code: string; message: string } | null;
  usage: AiUsage | null;
  sendMessage: (content: string, overrideOptions?: Partial<UseAiChatThreadOptions>) => Promise<void>;
  abort: () => void;
  stopStreaming: () => void;
  retryMessage: (messageId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  reloadMessages: () => Promise<void>;
}

/**
 * Feature hook for local-first AI chat threads.
 *
 * Automates thread resolution scoped by (materialId + mode), loads historical turns from
 * Dexie on mount, coordinates real-time streaming turns, and persists completed conversations.
 */
export function useAiChatThread(options: UseAiChatThreadOptions = {}): UseAiChatThreadResult {
  const context = useContext(ApplicationContext);
  const mode = options.mode ?? 'assistant';
  const materialId = options.materialId;

  const [thread, setThread] = useState<AiThread | null>(null);
  const [messages, setMessages] = useState<AiMessageRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [usage, setUsage] = useState<AiUsage | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!context?.useCases.ai) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const activeThread = await context.useCases.ai.getOrCreateThread.execute({
          materialId,
          mode,
        });
        if (cancelled) return;
        setThread(activeThread);

        const history = await context.useCases.ai.getThreadMessages.execute({
          threadId: activeThread.id,
        });
        if (cancelled) return;
        setMessages(history);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load chat history';
        setError({ code: 'LOAD_ERROR', message });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      abort();
    };
  }, [context, materialId, mode, abort]);

  const reloadMessages = useCallback(async () => {
    if (!thread || !context?.useCases.ai) return;
    const history = await context.useCases.ai.getThreadMessages.execute({
      threadId: thread.id,
    });
    setMessages(history);
  }, [context, thread]);

  const clearHistory = useCallback(async () => {
    if (!thread || !context?.useCases.ai) return;
    abort();
    try {
      await context.useCases.ai.deleteThread.execute({ threadId: thread.id });
      setMessages([]);
      setStreamingText('');
      setStreamingMessageId(null);
      setError(null);
      setUsage(null);
      // Re-create a fresh empty thread
      const newThread = await context.useCases.ai.getOrCreateThread.execute({
        materialId,
        mode,
      });
      setThread(newThread);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to clear thread history';
      setError({ code: 'CLEAR_ERROR', message });
    }
  }, [context, thread, materialId, mode, abort]);

  const sendMessage = useCallback(
    async (content: string, overrideOptions: Partial<UseAiChatThreadOptions> = {}) => {
      if (!context?.useCases.ai) {
        setError({
          code: 'CONTEXT_ERROR',
          message: 'AI use cases not available in ApplicationContext.',
        });
        return;
      }

      const trimmed = content.trim();
      if (!trimmed) return;

      abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Ensure thread is resolved
      let activeThread = thread;
      if (!activeThread) {
        activeThread = await context.useCases.ai.getOrCreateThread.execute({
          materialId,
          mode,
        });
        setThread(activeThread);
      }

      const userTime = new Date().toISOString();
      const userMessageRecord: AiMessageRecord = {
        id: `user-${crypto.randomUUID()}`,
        threadId: activeThread.id,
        role: 'user',
        content: trimmed,
        status: 'complete',
        createdAt: userTime,
      };

      // Optimistically append user message
      setMessages((prev) => [...prev, userMessageRecord]);
      setIsStreaming(true);
      setStreamingText('');
      setStreamingMessageId(null);
      setError(null);

      const mergedDocContext = overrideOptions.documentContext ?? options.documentContext;
      const mergedSelection = overrideOptions.selection ?? options.selection;
      const effectiveMode = overrideOptions.mode ?? mode;

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
      let streamError: { code: string; message: string } | null = null;

      try {
        const stream = context.useCases.ai.sendChatMessage.execute({
          threadId: activeThread.id,
          messages: chatMessagesPayload,
          document: mergedDocContext,
          selection: mergedSelection,
          mode: effectiveMode,
          signal: controller.signal,
        });

        for await (const event of stream) {
          if (controller.signal.aborted) break;

          switch (event.type) {
            case 'start':
              setStreamingMessageId(event.messageId);
              break;
            case 'token':
              accumulated += event.text;
              setStreamingText(accumulated);
              break;
            case 'done':
              if (event.usage) {
                setUsage(event.usage);
              }
              break;
            case 'error':
              streamError = { code: event.code, message: event.message };
              setError(streamError);
              break;
          }
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          const message = err instanceof Error ? err.message : 'Unknown streaming error';
          setError({ code: 'UNHANDLED_ERROR', message });
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setIsStreaming(false);
        setStreamingText('');
        setStreamingMessageId(null);

        // Synchronize persisted messages from Dexie
        if (activeThread && !controller.signal.aborted) {
          const refreshed = await context.useCases.ai.getThreadMessages.execute({
            threadId: activeThread.id,
          });
          setMessages(refreshed);
        }
      }
    },
    [context, thread, materialId, mode, options, messages, abort],
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

  return {
    thread,
    messages,
    isLoading,
    isStreaming,
    streamingMessageId,
    streamingText,
    error,
    usage,
    sendMessage,
    abort,
    stopStreaming: abort,
    retryMessage,
    clearHistory,
    reloadMessages,
  };
}
