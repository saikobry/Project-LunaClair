/**
 * The single owner of the cloze card front: the text a `fill_in_blank` card
 * shows before its blanks are expanded one at a time.
 *
 * It is its own unit rather than a private helper of `questionToCards` because
 * **two** consumers must agree on it exactly: the projection, which renders it,
 * and the cloze schedule-invalidation predicate, which must judge an edit by
 * the front the learner is actually tested on. Two separate implementations
 * could drift, and a drift means the reset policy silently stops matching what
 * is rendered — strictly worse than either behaviour on its own.
 *
 * Resolution rules, in order:
 * - an empty prompt, or one that reads generically ("fill in the blank"),
 *   contributes nothing, so the front is the bare `template`
 * - a prompt that is neither the template itself nor blank-bearing is real
 *   prose and is prefixed to the template
 * - a prompt that already carries the `___` markers *is* the cloze source, so it
 *   wins outright and the template is not read at all
 */
export function resolveClozeCardFront(prompt: string, template: string): string {
    const promptTrimmed = prompt.trim();
    const templateTrimmed = template.trim();

    if (!promptTrimmed || promptTrimmed.toLowerCase().includes('fill in the blank')) {
        return templateTrimmed;
    }
    if (promptTrimmed !== templateTrimmed && !promptTrimmed.includes('___')) {
        return `${promptTrimmed}\n\n${templateTrimmed}`;
    }
    return promptTrimmed;
}
