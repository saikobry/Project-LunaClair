import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardMaturityBar } from '../CardMaturityBar';
import type { CardMaturityBreakdown } from '../../../../../domain/analytics/models/analytics.types';

const base: CardMaturityBreakdown = {
    newCount: 3,
    learningCount: 1,
    reviewCount: 1,
    masteredCount: 1,
    totalCards: 6,
    orphanReviewCount: 0,
};

describe('CardMaturityBar', () => {
    it('labels the total as a card count, which is now the projected pool size', () => {
        render(<CardMaturityBar maturity={base} />);

        expect(screen.getByText('Card Maturity')).toBeInTheDocument();
        expect(screen.getByText('6 total flashcards')).toBeInTheDocument();
    });

    it('renders no orphan note when every review belongs to a projected card', () => {
        render(<CardMaturityBar maturity={base} />);

        expect(screen.queryByText(/active card pool/)).not.toBeInTheDocument();
    });

    it('discloses a single stranded schedule as a footnote, outside every bucket', () => {
        render(<CardMaturityBar maturity={{ ...base, orphanReviewCount: 1 }} />);

        // The total is untouched: an orphan is not folded into a bucket.
        expect(screen.getByText('6 total flashcards')).toBeInTheDocument();
        expect(
            screen.getByText('1 schedule sits outside the active card pool and is excluded from the counts above.'),
        ).toBeInTheDocument();
    });

    it('pluralises several stranded schedules', () => {
        render(<CardMaturityBar maturity={{ ...base, orphanReviewCount: 4 }} />);

        expect(
            screen.getByText('4 schedules sit outside the active card pool and are excluded from the counts above.'),
        ).toBeInTheDocument();
    });

    it('names the condition rather than one cause, so an archived question is not reported as a deletion', () => {
        render(<CardMaturityBar maturity={{ ...base, orphanReviewCount: 1 }} />);

        // `buildCardKeyPool` excludes ARCHIVED questions, so archiving one strands
        // its review while the question itself still exists. Copy that claims the
        // card "no longer exists" told a user who archived a question that it had
        // been deleted; the three real causes (deleted question, archived
        // question, retired cloze blank) are all "outside the active card pool".
        expect(screen.queryByText(/no longer exists/)).not.toBeInTheDocument();
        expect(screen.queryByText(/deleted/)).not.toBeInTheDocument();
        expect(screen.getByText(/outside the active card pool/)).toBeInTheDocument();
    });
});
