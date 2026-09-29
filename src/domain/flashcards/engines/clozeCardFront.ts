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
 * - a `template` carrying no cloze text at all — absent or blank — reduces the
 *   front to the prompt, which is the only text such a row still has
 * - an empty prompt, or one that reads generically ("fill in the blank"),
 *   contributes nothing, so the front is the bare `template`
 * - a prompt that is neither the template itself nor blank-bearing is real
 *   prose and is prefixed to the template
 * - a prompt that already carries the `___` markers *is* the cloze source, so it
 *   wins outright and the template is not read at all
 *
 * **`template` is typed `string`, not `unknown`.** It used to be widened and
 * normalised here, at the field's owner, because the package read tier deliberately
 * imported a `fill_in_blank` row carrying no usable `template` and reported it as a
 * warning — so both consumers could be handed a value the static type claimed could
 * not exist. That tier is gone, and every ingress to `db.questions` now validates, so
 * the parameter is honest as written and the `typeof` check is dead weight.
 *
 * An **empty** `template` is a different matter and is still handled above: a
 * `fill_in_blank` question whose author has not typed the template yet is a real
 * authoring state, not a defect, and it reduces to "the prompt is the whole front".
 * Both callers want that same answer — the projection renders the front, and the
 * invalidation policy must judge an edit by the front the learner is actually
 * tested on — so the shared function is what keeps them from drifting.
 *
 * `prompt` is deliberately NOT normalised: the package validator rejects a
 * non-string prompt, so it is a real defect and it must still surface as a
 * `TypeError`.
 */
export function resolveClozeCardFront(prompt: string, template: string): string {
    const promptTrimmed = prompt.trim();
    const templateTrimmed = template.trim();

    // No usable template: there is no cloze sentence on this row at all, so the
    // prompt is the whole front. Returning the empty string here — which is what
    // "the bare template" would mean — is what would print a card with a blank
    // face after the learner was told the question was only reduced.
    if (!templateTrimmed) return promptTrimmed;

    if (!promptTrimmed || promptTrimmed.toLowerCase().includes('fill in the blank')) {
        return templateTrimmed;
    }
    if (promptTrimmed !== templateTrimmed && !promptTrimmed.includes('___')) {
        return `${promptTrimmed}\n\n${templateTrimmed}`;
    }
    return promptTrimmed;
}
