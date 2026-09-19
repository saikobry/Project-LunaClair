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
  | { type: 'done'; usage?: AiUsage; model?: string }
  | { type: 'error'; code: string; message: string };

/**
 * Status of an individual message in persistence.
 */
export type AiMessageStatus = 'streaming' | 'complete' | 'error';

/**
 * Persisted AI conversation thread entity in Dexie IndexedDB.
 *
 * A thread is one conversation session. Sessions are scoped to a study material
 * (or to the global assistant when `materialId` is undefined); a material may
 * hold many sessions, and the newest by `updatedAt` is the one reopened.
 */
export interface AiThread {
  id: string;
  /** Optional: undefined = global assistant thread; string = material-scoped thread. */
  materialId?: string;
  title: string;
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
}

/**
 * Persisted chat turn record in Dexie IndexedDB.
 * System prompts are never persisted; only user and assistant turns are stored.
 */
export interface AiMessageRecord {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  status: AiMessageStatus;
  createdAt: string; // ISO 8601 UTC
  metadata?: {
    usage?: AiUsage;
    /** Provider model id that served the turn; the price rate card is keyed by it. */
    model?: string;
    errorCode?: string;
    errorMessage?: string;
  };
}

/**
 * Request payload for structured AI content generation.
 */
export interface AiGenerationRequest {
  systemPrompt?: string;
  userPrompt: string;
  documentContext?: AiDocumentContext;
  selection?: AiSelectionContext;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * Validator function for structured AI outputs.
 */
export type AiStructuredOutputValidator<T> = (
  data: unknown,
) => { success: true; data: T } | { success: false; error: string };

/**
 * Domain error raised when AI generation or output validation fails.
 */
export class AiGenerationError extends Error {
  code: string;

  constructor(message: string, code: string = 'GENERATION_FAILED') {
    super(message);
    this.name = 'AiGenerationError';
    this.code = code;
  }
}
