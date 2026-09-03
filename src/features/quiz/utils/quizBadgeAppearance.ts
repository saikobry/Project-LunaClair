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
  multiple_choice: { bg: '#dbeafe', fg: '#1d4ed8' },
  multiple_select: { bg: '#ede9fe', fg: '#6d28d9' },
  true_false: { bg: '#ccfbf1', fg: '#0f766e' },
  identification: { bg: '#fef3c7', fg: '#b45309' },
  fill_in_blank: { bg: '#fce7f3', fg: '#be185d' },
};

export const DIFFICULTY_APPEARANCE: Record<QuestionDifficulty, { bg: string; fg: string }> = {
  easy: { bg: 'var(--color-success-muted)', fg: 'var(--color-on-success-muted)' },
  medium: { bg: 'var(--color-warning-muted)', fg: 'var(--color-on-warning-muted)' },
  hard: { bg: 'var(--color-error-muted)', fg: 'var(--color-error)' },
};
