import * as stylex from '@stylexjs/stylex';
import {
  BookOpen,
  HelpCircle,
  Award,
  Layers,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import type { StudyPackageSummary } from '../../../domain/package/models/package.types';
import { packageStatsGridStyles as styles } from './packageStatsGrid.stylex';

export interface PackageStatsGridProps {
  /** Pre-fetched package summary (from `inspectStudyPackage`); no fetching here. */
  summary: StudyPackageSummary;
}

/**
 * Package metric stat cards (materials, questions, quizzes, flashcards,
 * assets, total points). Unifies the `StudyPackagePreviewModal` inline grid
 * with the `SharedPackageScreen` local `PackageStatsGrid` — same shape,
 * style, icons, and order in both.
 */
export function PackageStatsGrid({ summary }: PackageStatsGridProps) {
  const stats: Array<{ label: string; value: number; icon: React.ReactNode }> = [
    { label: 'Materials', value: summary.materialCount, icon: <BookOpen size={15} /> },
    { label: 'Questions', value: summary.questionCount, icon: <HelpCircle size={15} /> },
    { label: 'Quizzes', value: summary.quizCount, icon: <Award size={15} /> },
    { label: 'Flashcards', value: summary.flashcardCount, icon: <Layers size={15} /> },
    { label: 'Assets', value: summary.assetCount, icon: <ImageIcon size={15} /> },
    { label: 'Total Points', value: summary.totalPoints, icon: <Sparkles size={15} /> },
  ];

  return (
    <div {...stylex.props(styles.grid)}>
      {stats.map((stat) => (
        <div key={stat.label} {...stylex.props(styles.card)}>
          <div {...stylex.props(styles.cardHeader)}>
            {stat.icon}
            <span>{stat.label}</span>
          </div>
          <span {...stylex.props(styles.cardValue)}>{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
