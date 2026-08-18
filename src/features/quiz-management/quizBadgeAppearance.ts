import type { QuestionDifficulty } from '../../domain/quiz/Question';
import type { QuestionType } from '../../domain/quiz/QuestionType';

/**
 * Badge appearance per question type and difficulty — the single source of
 * truth for the semantic badge palette shared by the authoring surfaces (quiz
 * canvas collapsed card, question bank).
 *
 * SOURCING RULE (three tiers):
 * 1. QUESTION_TYPE_APPEARANCE — LITERAL hex. The type→color mapping is an
 *    arbitrary domain assignment: nothing outside quiz semantics says
 *    `multiple_choice` is blue, so the value has to be memorized here as
 *    domain knowledge. No token exists or should exist for it.
 * 2. DIFFICULTY_APPEARANCE — TOKEN references. Difficulty borrows the
 *    universal sentiment vocabulary (easy=success, medium=warning,
 *    hard=error): the "difficulty" part is domain, the green/amber/red part
 *    is sentiment semantics applied to a domain concept. Values resolve from
 *    the theme tokens so the records never repeat a value that has other
 *    consumers (which would recreate the drift bug this file exists to kill).
 * 3. POINTS_APPEARANCE — TOKEN references, but for HYGIENE not semantics:
 *    accent-muted/text-secondary are generic neutral tokens the points chip
 *    inherits from the shared chip default — there is no semantic claim that
 *    "points are accent-colored". Referencing them is just
 *    "don't duplicate a token value"; do not read semantic intent into it.
 *
 * The records are EXHAUSTIVE: adding a new `QuestionType` or
 * `QuestionDifficulty` value forces the compiler to give it an appearance
 * here, so a new question kind can never silently render with missing
 * styling.
 */

/**
 * Neutral badge appearance for the points chip — shared by every authoring
 * surface. Token HYGIENE tier: these are the generic neutral tokens the
 * shared chip primitive defaults to (accent-muted background,
 * text-secondary foreground), referenced rather than repeated.
 */
export const POINTS_APPEARANCE: { bg: string; fg: string } = {
    bg: 'var(--color-accent-muted)',
    fg: 'var(--color-text-secondary)',
};

/**
 * Arbitrary assignment tier — literal hex by design. The mapping is
 * domain knowledge (nothing outside quiz semantics determines these colors),
 * so the values live here as literals and are referenced everywhere.
 */
export const QUESTION_TYPE_APPEARANCE: Record<QuestionType, { bg: string; fg: string }> = {
    multiple_choice: { bg: '#dbeafe', fg: '#1d4ed8' },
    multiple_select: { bg: '#ede9fe', fg: '#6d28d9' },
    true_false: { bg: '#ccfbf1', fg: '#0f766e' },
    identification: { bg: '#fef3c7', fg: '#b45309' },
    fill_in_blank: { bg: '#fce7f3', fg: '#be185d' },
};

/**
 * Borrowed sentiment vocabulary tier — TOKEN references. Difficulty reuses
 * the universal success/warning/error sentiment (easy is "success green",
 * medium is "warning amber", hard is "error red"), so values resolve from
 * the theme tokens that own that vocabulary rather than repeating literals.
 */
export const DIFFICULTY_APPEARANCE: Record<QuestionDifficulty, { bg: string; fg: string }> = {
    easy: { bg: 'var(--color-success-muted)', fg: 'var(--color-on-success-muted)' },
    medium: { bg: 'var(--color-warning-muted)', fg: 'var(--color-on-warning-muted)' },
    // Error's readable-on-muted text IS `--color-error` itself — no separate
    // on-error-muted token needed.
    hard: { bg: 'var(--color-error-muted)', fg: 'var(--color-error)' },
};
