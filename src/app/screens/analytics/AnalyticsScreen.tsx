import * as stylex from '@stylexjs/stylex';
import { Page } from '../../../shared/ui/Page/Page';
import { useGlobalAnalytics } from '../../../features/analytics/hooks/queries/useGlobalAnalytics';
import { AnalyticsEmptyState } from '../../../features/analytics/components/AnalyticsEmptyState';
import { OverviewMetricCards } from '../../../features/analytics/components/overview/OverviewMetricCards';
import { CardMaturityBar } from '../../../features/analytics/components/retention/CardMaturityBar';
import { ReviewForecastChart } from '../../../features/analytics/components/retention/ReviewForecastChart';
import { SubjectMasteryGrid } from '../../../features/analytics/components/mastery/SubjectMasteryGrid';
import { ActivityHeatmap } from '../../../features/analytics/components/activity/ActivityHeatmap';

const styles = stylex.create({
  contentStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    width: '100%',
  },
  retentionRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 16,
    width: '100%',
  },
  loadingText: {
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    padding: '32px 0',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: 'var(--color-danger, #EF4444)',
    padding: '32px 0',
    textAlign: 'center',
  },
});

export function AnalyticsScreen() {
  const { analytics, isLoading, isError, error } = useGlobalAnalytics();

  if (isLoading) {
    return (
      <Page
        title="Learning Insights"
        description="Track performance, spaced repetition retention, and topic mastery."
      >
        <div {...stylex.props(styles.loadingText)}>
          Loading learning analytics...
        </div>
      </Page>
    );
  }

  if (isError || !analytics) {
    return (
      <Page
        title="Learning Insights"
        description="Track performance, spaced repetition retention, and topic mastery."
      >
        <div {...stylex.props(styles.errorText)}>
          {error ? error.message : 'Failed to load learning analytics.'}
        </div>
      </Page>
    );
  }

  const hasData = analytics.overview.quizzesCompleted > 0 || analytics.overview.totalCardReviews > 0;

  return (
    <Page
      title="Learning Insights"
      description="Track performance, spaced repetition retention, and topic mastery."
    >
      {!hasData ? (
        <AnalyticsEmptyState />
      ) : (
        <div {...stylex.props(styles.contentStack)}>
          {/* 1. Overview KPIs */}
          <OverviewMetricCards metrics={analytics.overview} />

          {/* 2. Spaced Repetition Retention & Forecast */}
          <div {...stylex.props(styles.retentionRow)}>
            <CardMaturityBar maturity={analytics.maturity} />
            <ReviewForecastChart forecast={analytics.forecast} />
          </div>

          {/* 3. 52-Week Activity Heatmap */}
          <ActivityHeatmap activity={analytics.activity} />

          {/* 4. Subject & Topic Mastery Matrix */}
          <SubjectMasteryGrid subjects={analytics.subjects} />
        </div>
      )}
    </Page>
  );
}

export default AnalyticsScreen;
