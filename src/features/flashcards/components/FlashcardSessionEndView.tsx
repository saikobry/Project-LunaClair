import * as stylex from '@stylexjs/stylex';
import { Trophy, RefreshCw, ArrowLeft } from 'lucide-react';
import type { FlashcardSessionSummary } from '../types/flashcardFeature.types';
import { Button } from '../../../shared/ui/Button/Button';

const styles = stylex.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        maxWidth: 600,
        width: '100%',
        margin: '0 auto',
        padding: '32px 16px',
        boxSizing: 'border-box',
    },
    card: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: 36,
        borderRadius: 20,
        backgroundColor: 'var(--color-background-surface)',
        border: '1px solid var(--color-border)',
        textAlign: 'center',
        width: '100%',
        boxSizing: 'border-box',
    },
    trophyBadge: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
        color: 'var(--color-success)',
    },
    title: {
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    subtitle: {
        fontSize: 14,
        color: 'var(--color-text-secondary)',
        margin: 0,
    },
    summaryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        width: '100%',
        marginTop: 16,
    },
    statItem: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'var(--color-background-muted)',
    },
    statCount: {
        fontSize: 18,
        fontWeight: 700,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
    },
    actionRow: {
        display: 'flex',
        gap: 12,
        marginTop: 16,
    },
});

interface FlashcardSessionEndViewProps {
    summary: FlashcardSessionSummary;
    onRestudy: () => void;
    onDone: () => void;
}

export function FlashcardSessionEndView({
    summary,
    onRestudy,
    onDone,
}: FlashcardSessionEndViewProps) {
    return (
        <div {...stylex.props(styles.container)}>
            <div {...stylex.props(styles.card)}>
                <div {...stylex.props(styles.trophyBadge)}>
                    <Trophy size={32} />
                </div>

                <h2 {...stylex.props(styles.title)}>Session Complete!</h2>
                <p {...stylex.props(styles.subtitle)}>
                    Great job! You reviewed {summary.totalReviewed}{' '}
                    {summary.totalReviewed === 1 ? 'card' : 'cards'}. Your responses have been scheduled with SM-2 spaced repetition.
                </p>

                <div {...stylex.props(styles.summaryGrid)}>
                    <div {...stylex.props(styles.statItem)}>
                        <span {...stylex.props(styles.statCount)} style={{ color: '#dc2626' }}>
                            {summary.againCount}
                        </span>
                        <span {...stylex.props(styles.statLabel)}>Again</span>
                    </div>

                    <div {...stylex.props(styles.statItem)}>
                        <span {...stylex.props(styles.statCount)} style={{ color: '#d97706' }}>
                            {summary.hardCount}
                        </span>
                        <span {...stylex.props(styles.statLabel)}>Hard</span>
                    </div>

                    <div {...stylex.props(styles.statItem)}>
                        <span {...stylex.props(styles.statCount)} style={{ color: 'var(--color-accent)' }}>
                            {summary.goodCount}
                        </span>
                        <span {...stylex.props(styles.statLabel)}>Good</span>
                    </div>

                    <div {...stylex.props(styles.statItem)}>
                        <span {...stylex.props(styles.statCount)} style={{ color: 'var(--color-success)' }}>
                            {summary.easyCount}
                        </span>
                        <span {...stylex.props(styles.statLabel)}>Easy</span>
                    </div>
                </div>

                <div {...stylex.props(styles.actionRow)}>
                    <Button
                        label="Study again"
                        variant="secondary"
                        icon={<RefreshCw size={15} />}
                        onClick={onRestudy}
                    >
                        Study Again
                    </Button>
                    <Button
                        label="Back to Deck Setup"
                        variant="primary"
                        icon={<ArrowLeft size={15} />}
                        onClick={onDone}
                    >
                        Back to Deck Setup
                    </Button>
                </div>
            </div>
        </div>
    );
}
