import type { QuestionDifficulty } from '../../../domain/quiz/models/Question';
import type { QuestionType } from '../../../domain/quiz/models/QuestionType';

/**
 * Badge appearance per question type and difficulty — the single source of
 * truth for the semantic badge palette shared by quiz surfaces (runner,
 * authoring canvas, question bank, AI generator).
 */
export const POINTS_APPEARANCE: { bg: string; fg: string } = {
  bg: 'var(--color-accent-muted)',
  fg: 'var(--color-text-secondary)',
};

export const QUESTION_TYPE_APPEARANCE: Record<QuestionType, { bg: string; fg: string }> = {
  multiple_choice: { bg: 'var(--color-badge-blue-bg)', fg: 'var(--color-badge-blue-fg)' },
  multiple_select: { bg: 'var(--color-badge-violet-bg)', fg: 'var(--color-badge-violet-fg)' },
  true_false: { bg: 'var(--color-badge-teal-bg)', fg: 'var(--color-badge-teal-fg)' },
  identification: { bg: 'var(--color-badge-amber-bg)', fg: 'var(--color-badge-amber-fg)' },
  fill_in_blank: { bg: 'var(--color-badge-pink-bg)', fg: 'var(--color-badge-pink-fg)' },
};

export const DIFFICULTY_APPEARANCE: Record<QuestionDifficulty, { bg: string; fg: string }> = {
  easy: { bg: 'var(--color-success-muted)', fg: 'var(--color-on-success-muted)' },
  medium: { bg: 'var(--color-warning-muted)', fg: 'var(--color-on-warning-muted)' },
  hard: { bg: 'var(--color-error-muted)', fg: 'var(--color-error)' },
};
