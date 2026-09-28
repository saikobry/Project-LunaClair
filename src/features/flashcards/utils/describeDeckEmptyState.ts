import type { DeckEmptyReason } from './deckCardStats';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export interface DeckEmptyCopyOptions {
    /** The instant the relative label is measured from. */
    now: Date;
    /**
     * IANA zone the far-future date label is read in. Only that one label needs a
     * zone — every relative label is a property of the two instants alone — so it
     * is a parameter only so a test can pin it. Defaults to the runtime zone.
     */
    timeZone?: string;
}

/**
 * The one sentence shown in place of a session when the current selection has
 * nothing to study.
 *
 * The two causes need different information and different feelings: an empty
 * selection is a filter result the user can undo, while "nothing due" is the
 * scheduler working as designed and must never read as a failure. The next due
 * time is therefore quoted rather than guessed, and always from the scope the
 * user is actually looking at.
 */
export function describeDeckEmptyState(
    reason: DeckEmptyReason,
    options: DeckEmptyCopyOptions
): string {
    if (reason.kind === 'no_cards_in_selection') {
        const scope = reason.scopeTitle ? `${reason.scopeTitle} has` : 'This selection has';
        return `${scope} no flashcards to study. Change the Quiz Filter, or select All Quizzes, to start a session.`;
    }

    const nextDueAtMs = reason.nextDueAt ? new Date(reason.nextDueAt).getTime() : Number.NaN;
    if (!Number.isFinite(nextDueAtMs)) {
        return 'Nothing due right now, and none of these cards has a scheduled due date yet.';
    }

    const label = formatNextDueLabel(nextDueAtMs, options.now, options.timeZone);
    return `Nothing due right now — the next card is due ${label}.`;
}

/**
 * A short, human "when": `in 45 minutes`, `in 6 hours`, `tomorrow`, `in 3 days`,
 * or a `Wed 14 Oct` date once relative wording stops being useful.
 *
 * The ladder runs on **24-hour windows, not calendar days**, deliberately. A
 * calendar-day reading would make the label depend on the viewer's clock — the
 * same two instants would say "in 6 hours" to one reader and "tomorrow" to
 * another, which is both wrong for a card due in 30 hours at 18:00 and untestable
 * without pinning a zone. The one label that genuinely is calendar-shaped (the
 * far-future date) takes the zone explicitly.
 */
export function formatNextDueLabel(
    nextDueAtMs: number,
    now: Date,
    timeZone?: string
): string {
    const diffMs = nextDueAtMs - now.getTime();
    if (diffMs <= 0) return 'now';

    if (diffMs < HOUR_MS) {
        const minutes = Math.max(1, Math.round(diffMs / MINUTE_MS));
        return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
    }

    if (diffMs < DAY_MS) {
        const hours = Math.round(diffMs / HOUR_MS);
        return `in ${hours} hour${hours === 1 ? '' : 's'}`;
    }

    if (diffMs < 2 * DAY_MS) return 'tomorrow';

    const days = Math.round(diffMs / DAY_MS);
    if (days <= 7) return `in ${days} days`;

    return formatDueDateLabel(
        nextDueAtMs,
        timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    );
}

/** `Wed 14 Oct` — assembled from parts so the output never depends on a locale's separators. */
function formatDueDateLabel(nextDueAtMs: number, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    }).formatToParts(new Date(nextDueAtMs));

    const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((candidate) => candidate.type === type)?.value ?? '';

    return `${part('weekday')} ${part('day')} ${part('month')}`;
}
