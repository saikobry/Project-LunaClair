/**
 * The single owner of the question-sourced card key scheme. The literal format
 * is durable — review state is persisted under these keys — so it must not
 * drift; call this instead of rebuilding the string.
 */
export function cardKeyForQuestion(questionId: string): string {
    return `q:${questionId}`;
}

/**
 * Per-blank key for a `fill_in_blank` question that expands to several cards.
 * Each blank is a separately schedulable fact, so it gets its own key and its
 * own SM-2 state; the `#<index>` suffix is what keeps those apart.
 *
 * The suffix cannot collide with a whole-question key because `#` is outside
 * the question-id charset (`[a-zA-Z0-9_-]`), so `q:<id>#0` is never reachable
 * as `cardKeyForQuestion(<some other id>)`.
 */
export function cardKeyForBlank(questionId: string, blankIndex: number): string {
    return `q:${questionId}#${blankIndex}`;
}
