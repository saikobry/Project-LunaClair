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
  /**
   * App-facing model id from the model catalog (`GET /api/ai/models`). Omitted = the catalog default.
   * The client names a model, never a provider; the Worker resolves it server-side.
   */
  model?: string;
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
  | {
      type: 'error';
      code: string;
      message: string;
      /**
       * Seconds the provider asked the caller to wait, when it stated one (a rate limit does).
       * A shared-capacity model depends on this to avoid spending the next request on a refusal.
       */
      retryAfterSeconds?: number;
    };

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
/**
 * Whether a conversation grounds its answers in the study material it belongs to.
 *
 * Per-conversation, not per-turn: a selected passage is transient and cannot be a property of a
 * thread, so a thread records only whether a material is in scope at all. The selection stays a
 * per-turn concern on the request.
 *
 * Deliberately **unindexed**. A previous thread-level capability field (`mode`, added in Dexie v9)
 * was pruned in v15 once tutor modes were retired, so keeping this off the index keeps the same
 * removal cheap. It survives where `mode` did not: `mode` duplicated per-turn prompt semantics that
 * belonged on the sending surface, whereas grounding is genuine conversation state no per-turn
 * surface can express — a user wants a grounded thread and an ungrounded thread at the same time.
 */
export type AiGroundingMode = 'none' | 'whole';

/**
 * Where a reader selection action (Explain / Simplify / Example) sends its turn.
 *
 * - `'latest'` — the turn continues the material's newest conversation (the one
 *   the drawer shows), creating one only when none exists.
 * - `'new'` — the turn always opens a distinct conversation, leaving the
 *   current one untouched.
 *
 * Device-local preference, not conversation state: `AiThread` stores none of it.
 */
export type AiSelectionThreadMode = 'latest' | 'new';

export interface AiThread {
  id: string;
  /** Optional: undefined = global assistant thread; string = material-scoped thread. */
  materialId?: string;
  title: string;
  createdAt: string; // ISO 8601 UTC
  /**
   * Whether this conversation answers from its material.
   *
   * Required on the domain type: absence is a property of the persistence row only
   * (`AiThreadRow`), which the repository normalizes away on read. A global thread
   * (`materialId === undefined`) is always `'none'` — there is no material to attach.
   */
  grounding: AiGroundingMode;
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
  /** App-facing model id from the model catalog. Omitted = the catalog default. */
  model?: string;
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
