import * as stylex from '@stylexjs/stylex';
import { formatQuestionType } from '../utils/packageFormat';
import { questionTypeBreakdownStyles as styles } from './questionTypeBreakdown.stylex';

export type QuestionTypeEntry = [type: string, count: number];

export interface QuestionTypeBreakdownProps {
  /** Pre-derived `Object.entries(summary.questionsByType)`; no fetching here. */
  entries: QuestionTypeEntry[];
  /**
   * Card chrome. The screen renders the section as a card; the modal owns its
   * own chrome and renders a plain stacked section instead.
   */
  variant?: 'card' | 'plain';
}

/**
 * Question-type badge list. Unifies the `StudyPackagePreviewModal` inline
 * badges with the `SharedPackageScreen` local `QuestionTypesCard` (renamed:
 * it renders badges, not a quiz card). Returns null on an empty list.
 */
export function QuestionTypeBreakdown({ entries, variant = 'card' }: QuestionTypeBreakdownProps) {
  if (entries.length === 0) return null;
  if (variant === 'plain') {
    return (
      <div {...stylex.props(styles.plainContainer)}>
        <span {...stylex.props(styles.sectionTitle)}>Question Types</span>
        <div {...stylex.props(styles.badgesList)}>
          {entries.map(([type, count]) => (
            <span key={type} {...stylex.props(styles.plainBadge)}>
              {formatQuestionType(type)}: <strong>{count}</strong>
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div {...stylex.props(styles.card)}>
      <h3 {...stylex.props(styles.sectionTitle)}>Question Types</h3>
      <div {...stylex.props(styles.badgesList)}>
        {entries.map(([type, count]) => (
          <span key={type} {...stylex.props(styles.badge)}>
            {formatQuestionType(type)}: <strong>{count}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
