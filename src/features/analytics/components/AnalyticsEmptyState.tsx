import * as stylex from '@stylexjs/stylex';
import { Sparkles } from 'lucide-react';
import { EmptyState } from '../../../shared/ui/EmptyState/EmptyState';
import { Card } from '../../../shared/ui/Card/Card';

const styles = stylex.create({
    cardWrapper: {
        width: '100%',
        padding: '32px 16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export function AnalyticsEmptyState() {
    return (
        <Card xstyle={styles.cardWrapper}>
            <EmptyState
                icon={<Sparkles size={28} />}
                title="Your learning journey starts here"
                description="Complete a quiz session or review some flashcards to begin building your study insights, mastery breakdown, and activity calendar."
                headingLevel="h2"
            />
        </Card>
    );
}
