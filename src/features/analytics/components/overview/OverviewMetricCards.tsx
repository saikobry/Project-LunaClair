import * as stylex from '@stylexjs/stylex';
import { Flame, Target, CheckCircle2, Layers } from 'lucide-react';
import type { StudyOverviewMetrics } from '../../../../domain/analytics/models/analytics.types';
import { Card } from '../../../../shared/ui/Card/Card';

const styles = stylex.create({
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        width: '100%',
    },
    cardContent: {
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
    },
    headerRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    label: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        margin: 0,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
    },
    iconBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-background-muted)',
        color: 'var(--color-text-secondary)',
    },
    flameBadge: {
        backgroundColor: 'rgba(249, 115, 22, 0.15)',
        color: '#EA580C',
    },
    targetBadge: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        color: '#2563EB',
    },
    quizBadge: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        color: '#059669',
    },
    cardBadge: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        color: '#7C3AED',
    },
    value: {
        fontSize: 28,
        fontWeight: 700,
        color: 'var(--color-text-primary)',
        margin: 0,
        lineHeight: 1.1,
    },
    subtext: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        margin: 0,
        lineHeight: 1.4,
    },
});

interface OverviewMetricCardsProps {
    metrics: StudyOverviewMetrics;
}

export function OverviewMetricCards({ metrics }: OverviewMetricCardsProps) {
    const accuracyLabel = metrics.totalAnsweredQuestions > 0
        ? `${metrics.globalQuizAccuracy}%`
        : '—';

    const accuracySubtext = metrics.totalAnsweredQuestions > 0
        ? `${metrics.totalCorrectAnswers} / ${metrics.totalAnsweredQuestions} correct answers`
        : 'No quiz answers yet';

    return (
        <div {...stylex.props(styles.grid)}>
            {/* 1. Streak */}
            <Card>
                <div {...stylex.props(styles.cardContent)}>
                    <div {...stylex.props(styles.headerRow)}>
                        <span {...stylex.props(styles.label)}>Study Streak</span>
                        <div {...stylex.props(styles.iconBadge, styles.flameBadge)}>
                            <Flame size={20} />
                        </div>
                    </div>
                    <div {...stylex.props(styles.value)}>
                        {metrics.currentStreakDays} {metrics.currentStreakDays === 1 ? 'day' : 'days'}
                    </div>
                    <div {...stylex.props(styles.subtext)}>
                        Best: {metrics.longestStreakDays} {metrics.longestStreakDays === 1 ? 'day' : 'days'}
                    </div>
                </div>
            </Card>

            {/* 2. Global Accuracy */}
            <Card>
                <div {...stylex.props(styles.cardContent)}>
                    <div {...stylex.props(styles.headerRow)}>
                        <span {...stylex.props(styles.label)}>Quiz Accuracy</span>
                        <div {...stylex.props(styles.iconBadge, styles.targetBadge)}>
                            <Target size={20} />
                        </div>
                    </div>
                    <div {...stylex.props(styles.value)}>
                        {accuracyLabel}
                    </div>
                    <div {...stylex.props(styles.subtext)}>
                        {accuracySubtext}
                    </div>
                </div>
            </Card>

            {/* 3. Quizzes Completed */}
            <Card>
                <div {...stylex.props(styles.cardContent)}>
                    <div {...stylex.props(styles.headerRow)}>
                        <span {...stylex.props(styles.label)}>Quizzes</span>
                        <div {...stylex.props(styles.iconBadge, styles.quizBadge)}>
                            <CheckCircle2 size={20} />
                        </div>
                    </div>
                    <div {...stylex.props(styles.value)}>
                        {metrics.quizzesCompleted}
                    </div>
                    <div {...stylex.props(styles.subtext)}>
                        Completed sessions
                    </div>
                </div>
            </Card>

            {/* 4. Total Card Reviews */}
            <Card>
                <div {...stylex.props(styles.cardContent)}>
                    <div {...stylex.props(styles.headerRow)}>
                        <span {...stylex.props(styles.label)}>Card Reviews</span>
                        <div {...stylex.props(styles.iconBadge, styles.cardBadge)}>
                            <Layers size={20} />
                        </div>
                    </div>
                    <div {...stylex.props(styles.value)}>
                        {metrics.totalCardReviews}
                    </div>
                    <div {...stylex.props(styles.subtext)}>
                        {metrics.cardsWithReviewHistory} cards with history
                    </div>
                </div>
            </Card>
        </div>
    );
}
