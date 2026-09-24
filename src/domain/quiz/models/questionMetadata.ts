import type { QuestionType } from './QuestionType';

/**
 * Canonical question-type vocabulary — the single owner of the metadata that
 * nine sites previously re-declared (option lists, label switches, validity
 * sets), which had already drifted (`Fill in Blank` vs `Fill in the Blank`,
 * `True/False` vs `True / False`).
 *
 * Labels are a domain fact, not UI copy: the question-type enumeration is
 * closed and stable (a new type is a multi-system event), and its display
 * label is as stable as the identifier itself — the same way a currency has a
 * canonical name that is not a presentation concern.
 */

/** Ordered type list — canonical iteration order for UI rendering. */
export const QUESTION_TYPES: readonly QuestionType[] = [
  'multiple_choice',
  'multiple_select',
  'true_false',
  'identification',
  'fill_in_blank',
];

/** Canonical display label per question type. Exhaustive over the union. */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  multiple_select: 'Multiple Select',
  true_false: 'True / False',
  identification: 'Identification',
  fill_in_blank: 'Fill in the Blank',
};

/** Validity set, derived from the ordered list. */
export const VALID_QUESTION_TYPES: ReadonlySet<QuestionType> = new Set(QUESTION_TYPES);
