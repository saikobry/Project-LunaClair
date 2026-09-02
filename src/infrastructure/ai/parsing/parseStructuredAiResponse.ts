import { AiGenerationError, type AiStructuredOutputValidator } from '../../../domain/ai/models/ai.types';

/**
 * Strips markdown code fences (e.g. ```json ... ```) from raw LLM output.
 */
function extractJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

/**
 * Performs a single, conservative, deterministic repair pass on JSON strings:
 * - Truncates leading/trailing non-JSON explanatory prose before the first `[` / `{` and after the last `]` / `}`.
 * - Removes illegal trailing commas before closing braces/brackets (`,}` -> `}`, `,]` -> `]`).
 *
 * NOTE: Never guesses or invents missing keys or values.
 */
function conservativeJsonRepair(text: string): string {
  let cleaned = text.trim();

  // Extract from the first '{' or '[' to the last '}' or ']'
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');

  let startIdx = -1;
  let isArray = false;
  if (firstBrace !== -1 && firstBracket !== -1) {
    if (firstBracket < firstBrace) {
      startIdx = firstBracket;
      isArray = true;
    } else {
      startIdx = firstBrace;
      isArray = false;
    }
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    isArray = true;
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
    isArray = false;
  }

  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const endIdx = Math.max(lastBrace, lastBracket);

  if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  // If this was an array that was cut off after an object (ends with '}'), close the array with ']'
  if (isArray && !cleaned.endsWith(']')) {
    cleaned += ']';
  }

  // Replace missing values before closing braces or commas: e.g. "correctIndex": } -> "correctIndex": null}
  cleaned = cleaned.replace(/:\s*([,}])/g, ': null$1');

  // Remove trailing commas before closing braces/brackets: e.g. [1, 2, ] -> [1, 2]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  return cleaned;
}

/**
 * Parses and validates structured JSON output from an AI provider.
 *
 * Flow:
 * 1. Strip markdown fences.
 * 2. Attempt direct JSON.parse -> validate.
 * 3. On failure, attempt one conservative repair -> validate.
 * 4. On persistent failure, throw AiGenerationError with code 'INVALID_STRUCTURED_OUTPUT'.
 */
export function parseStructuredAiResponse<T>(
  rawText: string,
  validator: AiStructuredOutputValidator<T>,
): T {
  if (!rawText || !rawText.trim()) {
    throw new AiGenerationError('AI response was empty', 'EMPTY_RESPONSE');
  }

  const unfenced = extractJsonFence(rawText);

  // Pass 1: Direct parse
  try {
    const parsed = JSON.parse(unfenced) as unknown;
    const validated = validator(parsed);
    if (validated.success) {
      return validated.data;
    }
  } catch {
    // Fall through to single conservative repair pass
  }

  // Pass 2: Conservative deterministic repair
  try {
    const repaired = conservativeJsonRepair(unfenced);
    const parsed = JSON.parse(repaired) as unknown;
    const validated = validator(parsed);
    if (validated.success) {
      return validated.data;
    }
    throw new AiGenerationError(
      `Structured output validation failed: ${validated.error}`,
      'INVALID_STRUCTURED_OUTPUT',
    );
  } catch (err: unknown) {
    if (err instanceof AiGenerationError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Malformed JSON syntax';
    throw new AiGenerationError(
      `Failed to parse structured JSON from AI output: ${message}`,
      'INVALID_STRUCTURED_OUTPUT',
    );
  }
}
