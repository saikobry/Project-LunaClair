import * as stylex from '@stylexjs/stylex';
import type { SubjectMastery } from '../../../../domain/analytics/models/analytics.types';
import { SubjectMasteryCard } from './SubjectMasteryCard';

const styles = stylex.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        margin: 0,
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16,
        width: '100%',
    },
    emptyText: {
        fontSize: 14,
        color: 'var(--color-text-secondary)',
        fontStyle: 'italic',
    },
});

interface SubjectMasteryGridProps {
    subjects: SubjectMastery[];
}

export function SubjectMasteryGrid({ subjects }: SubjectMasteryGridProps) {
    if (subjects.length === 0) {
        return (
            <div {...stylex.props(styles.container)}>
                <h2 {...stylex.props(styles.title)}>Subject & Topic Mastery</h2>
                <p {...stylex.props(styles.emptyText)}>No subjects found in library.</p>
            </div>
        );
    }

    return (
        <div {...stylex.props(styles.container)}>
            <h2 {...stylex.props(styles.title)}>Subject & Topic Mastery</h2>
            <div {...stylex.props(styles.grid)}>
                {subjects.map((sub) => (
                    <SubjectMasteryCard key={sub.subjectId} subject={sub} />
                ))}
            </div>
        </div>
    );
}
