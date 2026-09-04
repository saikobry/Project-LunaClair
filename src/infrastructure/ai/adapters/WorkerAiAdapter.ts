import type { AiService } from '../../../domain/ai/services/AiService';
import {
  AiGenerationError,
  type AiChatMessage,
  type AiChatRequest,
  type AiStreamEvent,
  type AiGenerationRequest,
  type AiStructuredOutputValidator,
} from '../../../domain/ai/models/ai.types';
import { parseStructuredAiResponse } from '../parsing/parseStructuredAiResponse';

export interface WorkerAiAdapterOptions {
  /** Base URL for API requests. Defaults to '' (relative to current origin / proxy). */
  baseUrl?: string;
}

/**
 * Concrete infrastructure adapter connecting LunaClair to the Cloudflare Worker AI gateway.
 *
 * Consumes the streaming SSE response (`/api/ai/chat`) and yields typed `AiStreamEvent` objects.
 */
export class WorkerAiAdapter implements AiService {
  private readonly baseUrl: string;

  constructor(options: WorkerAiAdapterOptions = {}) {
    this.baseUrl = options.baseUrl ?? '';
  }

  async *streamChat(request: AiChatRequest): AsyncIterable<AiStreamEvent> {
    const url = `${this.baseUrl}/api/ai/chat`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          documentContext: request.documentContext
            ? {
                id: request.documentContext.id,
                title: request.documentContext.title,
                markdown: request.documentContext.markdown,
              }
            : undefined,
          selection: request.selection
            ? {
                text: request.selection.text,
                surroundingHeading: request.selection.surroundingHeading,
                source: request.selection.source,
              }
            : undefined,
          mode: request.mode,
        }),
        signal: request.signal,
      });
    } catch (err: unknown) {
      if (request.signal?.aborted) {
        yield { type: 'error', code: 'ABORTED', message: 'Chat request was cancelled.' };
        return;
      }
      const message = err instanceof Error ? err.message : 'Network request failed';
      yield { type: 'error', code: 'NETWORK_ERROR', message };
      return;
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorJson = (await response.json()) as { error?: string };
        if (errorJson.error) {
          errorMessage = errorJson.error;
        }
      } catch {
        // Fallback to HTTP status text
      }
      yield { type: 'error', code: `HTTP_${response.status}`, message: errorMessage };
      return;
    }

    if (!response.body) {
      yield { type: 'error', code: 'NO_RESPONSE_BODY', message: 'No response body received from AI gateway.' };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (request.signal?.aborted) {
          await reader.cancel().catch(() => {});
          yield { type: 'error', code: 'ABORTED', message: 'Chat request was cancelled.' };
          return;
        }

        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last incomplete fragment in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;

          try {
            const event = JSON.parse(dataStr) as AiStreamEvent;
            if (event && typeof event.type === 'string') {
              yield event;
            }
          } catch {
            // Ignore unparseable SSE line
          }
        }
      }

      // Process any remaining buffered text
      if (buffer.trim().startsWith('data:')) {
        const dataStr = buffer.trim().slice(5).trim();
        if (dataStr && dataStr !== '[DONE]') {
          try {
            const event = JSON.parse(dataStr) as AiStreamEvent;
            if (event && typeof event.type === 'string') {
              yield event;
            }
          } catch {
            // Ignore
          }
        }
      }
    } catch (err: unknown) {
      if (request.signal?.aborted) {
        yield { type: 'error', code: 'ABORTED', message: 'Chat request was cancelled.' };
        return;
      }
      const message = err instanceof Error ? err.message : 'Stream processing failed';
      yield { type: 'error', code: 'STREAM_ERROR', message };
    } finally {
      reader.releaseLock();
    }
  }

  async generateStructured<T>(
    request: AiGenerationRequest,
    validator: AiStructuredOutputValidator<T>,
  ): Promise<T> {
    const messages: AiChatMessage[] = [
      {
        id: 'sys',
        role: 'system',
        content:
          request.systemPrompt ||
          'You are an educational AI assistant. You generate strictly formatted structured JSON output without preamble or commentary.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr',
        role: 'user',
        content: request.userPrompt,
        createdAt: new Date().toISOString(),
      },
    ];

    let accumulatedText = '';
    const stream = this.streamChat({
      messages,
      documentContext: request.documentContext,
      selection: request.selection,
      mode: 'assistant',
      signal: request.signal,
    });

    for await (const event of stream) {
      if (event.type === 'token') {
        accumulatedText += event.text;
      } else if (event.type === 'error') {
        throw new AiGenerationError(event.message, event.code);
      }
    }

    return parseStructuredAiResponse(accumulatedText, validator);
  }
}
