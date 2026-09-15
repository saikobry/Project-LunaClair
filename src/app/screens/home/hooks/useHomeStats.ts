import { useMemo } from 'react';
import type { GlobalAnalytics } from '../../../../domain/analytics/models/analytics.types';

export interface HomeStats {
  streakDays: number;
  dueToday: number;
  accuracy: number;
  answered: number;
  hasStats: boolean;
}

/** Headline numbers for the stat strip, with its visibility gate. */
export function useHomeStats(analytics: GlobalAnalytics | undefined): HomeStats {
  return useMemo(() => {
    const streakDays = analytics?.overview.currentStreakDays ?? 0;
    const dueToday = analytics?.forecast?.[0]?.dueCount ?? 0;
    const accuracy = analytics?.overview.globalQuizAccuracy ?? 0;
    const answered = analytics?.overview.totalAnsweredQuestions ?? 0;
    return {
      streakDays,
      dueToday,
      accuracy,
      answered,
      hasStats: streakDays > 0 || dueToday > 0 || answered > 0,
    };
  }, [analytics]);
}
