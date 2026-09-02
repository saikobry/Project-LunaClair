import * as stylex from '@stylexjs/stylex';
import type { ReviewForecastDay } from '../../../../domain/analytics/models/analytics.types';
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
    chartWrapper: {
        width: '100%',
        height: 140,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        paddingTop: 20,
    },
    barColumn: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
        justifyContent: 'flex-end',
        gap: 6,
    },
    countLabel: {
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
    },
    barTrack: {
        width: '100%',
        maxWidth: 32,
        height: 80,
        display: 'flex',
        alignItems: 'flex-end',
        backgroundColor: 'var(--color-background-muted)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    barFill: {
        width: '100%',
        backgroundColor: 'var(--color-accent)',
        borderRadius: 4,
        transition: 'height 0.3s ease',
    },
    dateLabel: {
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        whiteSpace: 'nowrap',
    },
});

interface ReviewForecastChartProps {
    forecast: ReviewForecastDay[];
}

function formatForecastDayLabel(index: number, dateKey: string): string {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';

    try {
        const [y, m, d] = dateKey.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return date.toLocaleDateString(undefined, { weekday: 'short' });
    } catch {
        return `+${index}d`;
    }
}

export function ReviewForecastChart({ forecast }: ReviewForecastChartProps) {
    const maxCount = Math.max(1, ...forecast.map((f) => f.dueCount));
    const totalDue = forecast.length > 0 ? forecast[forecast.length - 1].cumulativeDue : 0;

    return (
        <Card>
            <div {...stylex.props(styles.container)}>
                <div {...stylex.props(styles.header)}>
                    <h3 {...stylex.props(styles.title)}>7-Day Review Forecast</h3>
                    <span {...stylex.props(styles.subtitle)}>{totalDue} total reviews due</span>
                </div>

                <div {...stylex.props(styles.chartWrapper)}>
                    {forecast.map((day, idx) => {
                        const heightPct = day.dueCount > 0
                            ? Math.max(12, Math.round((day.dueCount / maxCount) * 100))
                            : 0;

                        return (
                            <div key={day.date} {...stylex.props(styles.barColumn)}>
                                <span {...stylex.props(styles.countLabel)}>
                                    {day.dueCount > 0 ? day.dueCount : 0}
                                </span>
                                <div {...stylex.props(styles.barTrack)}>
                                    <div
                                        {...stylex.props(styles.barFill)}
                                        style={{ height: `${heightPct}%` }}
                                    />
                                </div>
                                <span {...stylex.props(styles.dateLabel)}>
                                    {formatForecastDayLabel(idx, day.date)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
}
