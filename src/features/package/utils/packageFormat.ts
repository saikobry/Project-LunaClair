import type { QuestionType } from '../../../domain/quiz/models/QuestionType';
import { QUESTION_TYPE_LABELS } from '../../../domain/quiz/models/questionMetadata';

/**
 * Canonical package display formatters.
 *
 * Question-type labels come from the domain's `questionMetadata` — this is a
 * safe accessor over that canonical vocabulary (unknown ids degrade to the
 * id with underscores spaced), not a second label list.
 */
export function formatQuestionType(type: string): string {
  return QUESTION_TYPE_LABELS[type as QuestionType] ?? type.replace(/_/g, ' ');
}

export function formatPackageDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
