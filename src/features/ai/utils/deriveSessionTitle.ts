const MAX_TITLE_LENGTH = 60;

/**
 * Derives a conversation title from the first prompt of a session, so session
 * history reads as identifiable conversations instead of identical rows.
 *
 * Whitespace is collapsed and long prompts are truncated on a word-neutral
 * boundary with an ellipsis. Returns an empty string when the prompt has no
 * usable text — callers treat that as "leave the title alone".
 */
export function deriveSessionTitle(prompt: string): string {
  const collapsed = prompt.replace(/\s+/g, ' ').trim();

  if (collapsed.length <= MAX_TITLE_LENGTH) {
    return collapsed;
  }

  return `${collapsed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}
