import type { AiChatRequest, AiStreamEvent } from './ai.types';

/**
 * Provider-agnostic capability port for AI interactions in LunaClair.
 *
 * Implementations (e.g. WorkerAiAdapter, MockAiAdapter) handle
 * the underlying transport (SSE, HTTP, etc.) and model invocation.
 */
export interface AiService {
  /**
   * Streams chat tokens and lifecycle events for an interactive conversation.
   */
  streamChat(request: AiChatRequest): AsyncIterable<AiStreamEvent>;
}
