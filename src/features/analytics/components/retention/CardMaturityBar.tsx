import * as stylex from '@stylexjs/stylex';
import type { CardMaturityBreakdown } from '../../../../domain/analytics/models/analytics.types';
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
    barContainer: {
        display: 'flex',
        width: '100%',
        height: 16,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: 'var(--color-background-muted)',
    },
    segment: {
        height: '100%',
        transition: 'width 0.3s ease',
    },
    masteredSegment: {
        backgroundColor: '#10B981',
    },
    reviewSegment: {
        backgroundColor: '#8B5CF6',
    },
    learningSegment: {
        backgroundColor: '#3B82F6',
    },
    newSegment: {
        backgroundColor: '#94A3B8',
    },
    legendGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 12,
        marginTop: 4,
    },
    legendItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
    },
    legendHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: '50%',
    },
    masteredDot: {
        backgroundColor: '#10B981',
    },
    reviewDot: {
        backgroundColor: '#8B5CF6',
    },
    learningDot: {
        backgroundColor: '#3B82F6',
    },
    newDot: {
        backgroundColor: '#94A3B8',
    },
    legendValue: {
        fontSize: 15,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
    },
    legendPercent: {
        fontSize: 12,
        fontWeight: 400,
        color: 'var(--color-text-disabled)',
        marginLeft: 4,
    },
});

interface CardMaturityBarProps {
    maturity: CardMaturityBreakdown;
}

export function CardMaturityBar({ maturity }: CardMaturityBarProps) {
    const total = maturity.totalCards;
    const masteredPct = total > 0 ? (maturity.masteredCount / total) * 100 : 0;
    const reviewPct = total > 0 ? (maturity.reviewCount / total) * 100 : 0;
    const learningPct = total > 0 ? (maturity.learningCount / total) * 100 : 0;
    const newPct = total > 0 ? (maturity.newCount / total) * 100 : 0;

    return (
        <Card>
            <div {...stylex.props(styles.container)}>
                <div {...stylex.props(styles.header)}>
                    <h3 {...stylex.props(styles.title)}>Card Maturity</h3>
                    <span {...stylex.props(styles.subtitle)}>{total} total flashcards</span>
                </div>

                {/* Stacked Progress Bar */}
                <div {...stylex.props(styles.barContainer)} role="progressbar" aria-valuenow={Math.round(masteredPct)} aria-valuemin={0} aria-valuemax={100}>
                    {masteredPct > 0 && (
                        <div
                            {...stylex.props(styles.segment, styles.masteredSegment)}
                            style={{ width: `${masteredPct}%` }}
                            title={`Mastered: ${maturity.masteredCount} (${Math.round(masteredPct)}%)`}
                        />
                    )}
                    {reviewPct > 0 && (
                        <div
                            {...stylex.props(styles.segment, styles.reviewSegment)}
                            style={{ width: `${reviewPct}%` }}
                            title={`Review: ${maturity.reviewCount} (${Math.round(reviewPct)}%)`}
                        />
                    )}
                    {learningPct > 0 && (
                        <div
                            {...stylex.props(styles.segment, styles.learningSegment)}
                            style={{ width: `${learningPct}%` }}
                            title={`Learning: ${maturity.learningCount} (${Math.round(learningPct)}%)`}
                        />
                    )}
                    {newPct > 0 && (
                        <div
                            {...stylex.props(styles.segment, styles.newSegment)}
                            style={{ width: `${newPct}%` }}
                            title={`New: ${maturity.newCount} (${Math.round(newPct)}%)`}
                        />
                    )}
                </div>

                {/* Legend */}
                <div {...stylex.props(styles.legendGrid)}>
                    <div {...stylex.props(styles.legendItem)}>
                        <div {...stylex.props(styles.legendHeader)}>
                            <span {...stylex.props(styles.dot, styles.masteredDot)} />
                            <span>Mastered</span>
                        </div>
                        <div {...stylex.props(styles.legendValue)}>
                            {maturity.masteredCount}
                            <span {...stylex.props(styles.legendPercent)}>({Math.round(masteredPct)}%)</span>
                        </div>
                    </div>

                    <div {...stylex.props(styles.legendItem)}>
                        <div {...stylex.props(styles.legendHeader)}>
                            <span {...stylex.props(styles.dot, styles.reviewDot)} />
                            <span>Review</span>
                        </div>
                        <div {...stylex.props(styles.legendValue)}>
                            {maturity.reviewCount}
                            <span {...stylex.props(styles.legendPercent)}>({Math.round(reviewPct)}%)</span>
                        </div>
                    </div>

                    <div {...stylex.props(styles.legendItem)}>
                        <div {...stylex.props(styles.legendHeader)}>
                            <span {...stylex.props(styles.dot, styles.learningDot)} />
                            <span>Learning</span>
                        </div>
                        <div {...stylex.props(styles.legendValue)}>
                            {maturity.learningCount}
                            <span {...stylex.props(styles.legendPercent)}>({Math.round(learningPct)}%)</span>
                        </div>
                    </div>

                    <div {...stylex.props(styles.legendItem)}>
                        <div {...stylex.props(styles.legendHeader)}>
                            <span {...stylex.props(styles.dot, styles.newDot)} />
                            <span>New</span>
                        </div>
                        <div {...stylex.props(styles.legendValue)}>
                            {maturity.newCount}
                            <span {...stylex.props(styles.legendPercent)}>({Math.round(newPct)}%)</span>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
