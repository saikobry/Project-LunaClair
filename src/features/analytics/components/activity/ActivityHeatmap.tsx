import * as stylex from '@stylexjs/stylex';
import type { ActivityDay } from '../../../../domain/analytics/models/analytics.types';
import { Card } from '../../../../shared/ui/Card/Card';

const styles = stylex.create({
    container: {
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    header: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
    },
    title: {
        fontSize: 16,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    subtitle: {
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        margin: 0,
    },
    scrollWrapper: {
        width: '100%',
        overflowX: 'auto',
        paddingBottom: 8,
    },
    heatmapGrid: {
        display: 'grid',
        gridTemplateRows: 'repeat(7, 12px)',
        gridAutoFlow: 'column',
        gap: 3,
        width: 'max-content',
    },
    dayCell: {
        width: 12,
        height: 12,
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'transform 0.1s ease',
        ':hover': {
            transform: 'scale(1.3)',
        },
    },
    level0: {
        backgroundColor: 'var(--color-background-muted)',
    },
    level1: {
        backgroundColor: 'rgba(16, 185, 129, 0.30)',
    },
    level2: {
        backgroundColor: 'rgba(16, 185, 129, 0.55)',
    },
    level3: {
        backgroundColor: 'rgba(16, 185, 129, 0.80)',
    },
    level4: {
        backgroundColor: '#10B981',
    },
    footer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 6,
        fontSize: 12,
        color: 'var(--color-text-secondary)',
    },
    legendRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 3,
    },
});

interface ActivityHeatmapProps {
    activity: ActivityDay[];
}

function getLevelStyle(level: 0 | 1 | 2 | 3 | 4) {
    switch (level) {
        case 1:
            return styles.level1;
        case 2:
            return styles.level2;
        case 3:
            return styles.level3;
        case 4:
            return styles.level4;
        default:
            return styles.level0;
    }
}

export function ActivityHeatmap({ activity }: ActivityHeatmapProps) {
    const totalActivities = activity.reduce((sum, d) => sum + d.totalActivities, 0);

    return (
        <Card>
            <div {...stylex.props(styles.container)}>
                <div {...stylex.props(styles.header)}>
                    <h3 {...stylex.props(styles.title)}>Study Activity</h3>
                    <span {...stylex.props(styles.subtitle)}>{totalActivities} total events in past year</span>
                </div>

                <div {...stylex.props(styles.scrollWrapper)}>
                    <div {...stylex.props(styles.heatmapGrid)}>
                        {activity.map((day) => {
                            const tooltip = `${day.date}: ${day.quizzesCount} ${day.quizzesCount === 1 ? 'quiz' : 'quizzes'} · ${day.activeCardsCount} ${day.activeCardsCount === 1 ? 'card' : 'cards'} with latest review today`;
                            return (
                                <div
                                    key={day.date}
                                    {...stylex.props(styles.dayCell, getLevelStyle(day.intensityLevel))}
                                    title={tooltip}
                                    aria-label={tooltip}
                                />
                            );
                        })}
                    </div>
                </div>

                <div {...stylex.props(styles.footer)}>
                    <span>Less</span>
                    <div {...stylex.props(styles.legendRow)}>
                        <div {...stylex.props(styles.dayCell, styles.level0)} title="0 activities" />
                        <div {...stylex.props(styles.dayCell, styles.level1)} title="1 activity" />
                        <div {...stylex.props(styles.dayCell, styles.level2)} title="2-3 activities" />
                        <div {...stylex.props(styles.dayCell, styles.level3)} title="4-6 activities" />
                        <div {...stylex.props(styles.dayCell, styles.level4)} title="7+ activities" />
                    </div>
                    <span>More</span>
                </div>
            </div>
        </Card>
    );
}
