/**
 * The single owner of the question-sourced card key scheme. The literal format
 * is durable — review state is persisted under these keys — so it must not
 * drift; call this instead of rebuilding the string.
 */
export function cardKeyForQuestion(questionId: string): string {
    return `q:${questionId}`;
}
