/**
 * Normalizes Workers AI token-usage telemetry into the application's camelCase `AiUsage` contract.
 *
 * Cloudflare reports OpenAI-style snake_case (`prompt_tokens` / `completion_tokens` / `total_tokens`)
 * on the final chunk of a streamed response. The client models the same numbers as
 * `promptTokens` / `completionTokens` / `totalTokens`, so the translation belongs here rather than in
 * the route handler — this is the one place that knows both vocabularies.
 */

export interface AiTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Accepts only real token counts; a malformed or negative value is treated as absent. */
function toTokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Reads a Workers AI `usage` payload into `AiUsage`.
 *
 * Returns `undefined` when the payload carries no usable counts, so callers omit the field instead of
 * reporting a fabricated zero — a request that genuinely consumed nothing is indistinguishable from
 * one whose usage the provider did not report, and only the latter should be silent.
 *
 * `totalTokens` is derived from its two components only when **both** are present. Cloudflare reports
 * all three together; summing a partial pair would publish a total that neither the prompt nor the
 * output supports.
 */
export function readAiTokenUsage(raw: unknown): AiTokenUsage | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const source = raw as Record<string, unknown>;
  const promptTokens = toTokenCount(source.prompt_tokens ?? source.promptTokens);
  const completionTokens = toTokenCount(source.completion_tokens ?? source.completionTokens);

  let totalTokens = toTokenCount(source.total_tokens ?? source.totalTokens);
  if (totalTokens === undefined && promptTokens !== undefined && completionTokens !== undefined) {
    totalTokens = promptTokens + completionTokens;
  }

  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) {
    return undefined;
  }

  const usage: AiTokenUsage = {};
  if (promptTokens !== undefined) usage.promptTokens = promptTokens;
  if (completionTokens !== undefined) usage.completionTokens = completionTokens;
  if (totalTokens !== undefined) usage.totalTokens = totalTokens;
  return usage;
}
