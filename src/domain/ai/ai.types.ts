/**
 * AI Tutor interaction modes.
 */
export type AiTutorMode =
  | 'assistant'
  | 'socratic'
  | 'explain'
  | 'simplify'
  | 'example';

/**
 * Role in an AI chat conversation.
 */
export type AiChatRole = 'user' | 'assistant' | 'system';

/**
 * Chat message model for domain interactions.
 */
export interface AiChatMessage {
  id: string;
  role: AiChatRole;
  content: string;
  createdAt: string; // ISO 8601 UTC
}

/**
 * Document context provided to the AI.
 */
export interface AiDocumentContext {
  id: string;
  title: string;
  markdown: string;
}

/**
 * Selection context when asking about specific text.
 */
export interface AiSelectionContext {
  text: string;
  surroundingHeading?: string;
  source?: string;
}

/**
 * Request payload for streaming chat.
 */
export interface AiChatRequest {
  messages: AiChatMessage[];
  documentContext?: AiDocumentContext;
  selection?: AiSelectionContext;
  mode: AiTutorMode;
  signal?: AbortSignal;
}

/**
 * Token usage telemetry from the AI provider.
 */
export interface AiUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * Stream event emitted by the AI service during token generation.
 */
export type AiStreamEvent =
  | { type: 'start'; messageId: string }
  | { type: 'token'; text: string }
  | { type: 'done'; usage?: AiUsage }
  | { type: 'error'; code: string; message: string };
