import * as stylex from '@stylexjs/stylex';
import { formatQuestionType } from '../utils/packageFormat';
import { questionTypeBreakdownStyles as styles } from './questionTypeBreakdown.stylex';

export type QuestionTypeEntry = [type: string, count: number];

export interface QuestionTypeBreakdownProps {
  /** Pre-derived `Object.entries(summary.questionsByType)`; no fetching here. */
  entries: QuestionTypeEntry[];
  /**
   * Whether this component renders its own card frame. `card` (default) is for
   * screens with bare backgrounds; `none` renders a plain stacked section for
   * hosts that supply their own chrome (the preview modal).
   */
  chrome?: 'card' | 'none';
}

/**
 * Question-type badge list. Unifies the `StudyPackagePreviewModal` inline
 * badges with the `SharedPackageScreen` local `QuestionTypesCard` (renamed:
 * it renders badges, not a quiz card). Returns null on an empty list.
 */
export function QuestionTypeBreakdown({ entries, chrome = 'card' }: QuestionTypeBreakdownProps) {
  if (entries.length === 0) return null;
  if (chrome === 'none') {
    return (
      <div {...stylex.props(styles.noChromeContainer)}>
        <span {...stylex.props(styles.sectionTitle)}>Question Types</span>
        <div {...stylex.props(styles.badgesList)}>
          {entries.map(([type, count]) => (
            <span key={type} {...stylex.props(styles.noChromeBadge)}>
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
