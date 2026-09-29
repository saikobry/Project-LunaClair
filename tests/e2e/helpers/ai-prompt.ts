/**
 * Reading what the AI generator actually asked for, out of a `/api/ai/chat` request.
 *
 * A route mock that has to answer a generation request needs to know which question types
 * the app requested, and the only honest source is the request itself. The requested types are
 * stated on the app's own `- Allowed Question Types:` line in the **system** prompt (the AI
 * adapter sends `systemPrompt` as a system-role message), so this reads that line rather than
 * sniffing the schema blocks or the user message.
 *
 * **Deliberately tolerant.** The signal is coupled to prompt wording, and a harmless prompt
 * edit — reordering the criteria, renaming the line, changing the list separator — must not
 * fail a spec with a confusing "expected 1, got 0" assertion. An unrecognised prompt therefore
 * yields an empty list rather than a throw, which routes the mock down its default branch and
 * lets the spec's own content assertion (the draft it expects to see) explain the failure.
 * Only a line that cannot be read at all is worth a diagnostic, and that is what
 * `describeUnreadableAllowedTypes` is for.
 */

/** One message of an `/api/ai/chat` request body. */
export interface AiChatRequestMessage {
  role: string;
  content: string;
}

/** The request body shape these mocks read. Every field is optional — a mock must not crash on it. */
export interface AiChatRequestBody {
  messages?: AiChatRequestMessage[];
}

/**
 * The line the generator writes into its system prompt, captured loosely on purpose: any
 * leading bullet, spacing, and casing is accepted, so reformatting the criteria block does not
 * break the read. The value after the colon is what matters.
 *
 * Every gap is **horizontal** whitespace (`[^\S\r\n]`, not `\s`) on purpose. A `\s` gap would
 * let a value-less line reach past its own newline and capture the *next* line's text as the
 * type list — a prompt edit that removed the value would then be answered with whatever
 * happened to follow, which is the confident-wrong-answer failure this helper exists to avoid.
 * The value group is `.*` and is trimmed and emptiness-checked by the caller, so a present-but-
 * empty value yields no types rather than a phantom one.
 */
const ALLOWED_TYPES_LINE = /^[^\S\r\n]*[-*•]?[^\S\r\n]*allowed[^\S\r\n]+question[^\S\r\n]+types[^\S\r\n]*:[^\S\r\n]*(.*)$/im;

/** Splits a captured value into trimmed, non-empty type tokens. */
function parseTypeList(value: string): string[] {
  return value
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/**
 * The question types this request asked the generator for, or `[]` when the prompt carries no
 * readable "Allowed Question Types" line.
 *
 * Only the **last** system message is read: a request may carry an earlier system message
 * (a conversation preamble) and the generator's own prompt is the trailing one, so scanning
 * forward and keeping the last hit resolves the ambiguity in the app's favour.
 */
export function readAllowedQuestionTypes(messages: readonly AiChatRequestMessage[]): string[] {
  // Defensive on purpose: this reads an untyped request body off a live route handler, so a
  // missing or malformed `messages` must degrade to "no types" rather than crash the mock.
  if (!Array.isArray(messages)) return [];

  const systemMessages = messages.filter((message) => message?.role === 'system');

  for (let i = systemMessages.length - 1; i >= 0; i--) {
    const content = systemMessages[i]?.content;
    if (typeof content !== 'string') continue;

    const match = ALLOWED_TYPES_LINE.exec(content);
    if (!match) continue;

    const types = parseTypeList(match[1]);
    if (types.length > 0) return types;
  }

  return [];
}

/** `true` when the request asked for exactly the given type and nothing else. */
export function requestsOnlyType(
  messages: readonly AiChatRequestMessage[],
  type: string,
): boolean {
  const types = readAllowedQuestionTypes(messages);
  return types.length === 1 && types[0] === type;
}

/**
 * A one-line reason to attach when a generation spec found no readable types line, so a
 * prompt-wording change is reported as a prompt-wording change rather than as a content
 * mismatch further down the spec.
 */
export function describeUnreadableAllowedTypes(systemPrompt: string): string {
  return systemPrompt.includes('Allowed Question Types')
    ? 'The system prompt names "Allowed Question Types" but the value could not be parsed — ' +
        'update `readAllowedQuestionTypes` in tests/e2e/helpers/ai-prompt.ts for the new format.'
    : 'The system prompt has no "Allowed Question Types" line — update ' +
        '`readAllowedQuestionTypes` in tests/e2e/helpers/ai-prompt.ts if the prompt was renamed.';
}
