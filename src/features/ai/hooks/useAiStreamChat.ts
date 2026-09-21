import { useState, useRef, useCallback, useContext } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import type {
  AiChatMessage,
  AiTutorMode,
  AiUsage,
} from '../../../domain/ai/models/ai.types';

export interface SendAiMessageOptions {
  selection?: {
    text: string;
    surroundingHeading?: string;
    source?: string;
  };
  mode?: AiTutorMode;
}

export interface UseAiStreamChatResult {
  messages: AiChatMessage[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  streamingText: string;
  error: { code: string; message: string } | null;
  usage: AiUsage | null;
  sendMessage: (content: string, options?: SendAiMessageOptions) => Promise<void>;
  abort: () => void;
  clearMessages: () => void;
}

/**
 * Feature hook for streaming AI chat conversations.
 *
 * Manages token accumulation, user & assistant message state, and cancellation.
 */
export function useAiStreamChat(initialMessages: AiChatMessage[] = []): UseAiStreamChatResult {
  const context = useContext(ApplicationContext);
  const [messages, setMessages] = useState<AiChatMessage[]>(initialMessages);
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

  const clearMessages = useCallback(() => {
    abort();
    setMessages([]);
    setStreamingText('');
    setStreamingMessageId(null);
    setError(null);
    setUsage(null);
  }, [abort]);

  const sendMessage = useCallback(
    async (content: string, options: SendAiMessageOptions = {}) => {
      if (!context?.useCases.ai.sendChatMessage) {
        setError({
          code: 'CONTEXT_ERROR',
          message: 'AI use cases not available in ApplicationContext.',
        });
        return;
      }

      const trimmed = content.trim();
      if (!trimmed) return;

      // Abort any ongoing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const userMessage: AiChatMessage = {
        id: `user-${crypto.randomUUID()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsStreaming(true);
      setStreamingText('');
      setStreamingMessageId(null);
      setError(null);

      let accumulated = '';
      let activeAssistantId: string | null = null;

      try {
        const stream = context.useCases.ai.sendChatMessage.execute({
          messages: updatedMessages,
          selection: options.selection,
          mode: options.mode,
          signal: controller.signal,
        });

        for await (const event of stream) {
          if (controller.signal.aborted) break;

          switch (event.type) {
            case 'start':
              activeAssistantId = event.messageId;
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
              setError({ code: event.code, message: event.message });
              break;
          }
        }

        // Commit final assistant message if any text was accumulated
        if (accumulated && !controller.signal.aborted) {
          const assistantMessage: AiChatMessage = {
            id: activeAssistantId || `assistant-${crypto.randomUUID()}`,
            role: 'assistant',
            content: accumulated,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
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
      }
    },
    [context, messages],
  );

  return {
    messages,
    isStreaming,
    streamingMessageId,
    streamingText,
    error,
    usage,
    sendMessage,
    abort,
    clearMessages,
  };
}
