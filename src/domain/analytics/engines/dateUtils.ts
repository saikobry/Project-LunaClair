/**
 * Pure date utilities for timezone-aware local calendar calculations and ISO timestamp parsing.
 * Zero UI or external library dependencies.
 */

/**
 * Converts a UTC ISO timestamp or Date object into a local calendar date key (YYYY-MM-DD).
 * @param timestamp ISO 8601 string or Date object
 * @param timeZone Optional IANA time zone identifier (e.g. 'UTC', 'America/New_York', 'Asia/Tokyo').
 *                 Defaults to runtime-local timezone.
 */
export function toLocalDateKey(timestamp: string | Date, timeZone?: string): string {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date timestamp: ${String(timestamp)}`);
    }

    if (timeZone) {
        // Use Intl.DateTimeFormat for explicit timezone conversion
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        return formatter.format(date); // en-CA formats as YYYY-MM-DD
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parses an ISO 8601 timestamp string into a Date instant safely.
 */
export function parseInstant(timestamp: string): Date {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid ISO timestamp: ${timestamp}`);
    }
    return date;
}

/**
 * Adds integer days to a Date object without mutating the original Date.
 */
export function addDays(date: Date, days: number): Date {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Computes the difference in calendar days between two YYYY-MM-DD date keys (dateB - dateA).
 */
export function diffCalendarDays(dateKeyA: string, dateKeyB: string): number {
    const [yA, mA, dA] = dateKeyA.split('-').map(Number);
    const [yB, mB, dB] = dateKeyB.split('-').map(Number);

    const utcA = Date.UTC(yA, mA - 1, dA);
    const utcB = Date.UTC(yB, mB - 1, dB);

    return Math.round((utcB - utcA) / 86400000);
}

/**
 * Produces a contiguous chronological array of YYYY-MM-DD date keys ending at referenceDate.
 * @param daysCount Number of days in the window (e.g. 365 or 7)
 * @param referenceDate End date of the window (defaults to now)
 * @param timeZone Optional IANA time zone identifier
 */
export function getCalendarDaysWindow(
    daysCount: number,
    referenceDate: Date = new Date(),
    timeZone?: string,
): string[] {
    if (daysCount <= 0) return [];

    const keys: string[] = [];
    for (let i = daysCount - 1; i >= 0; i--) {
        const d = addDays(referenceDate, -i);
        keys.push(toLocalDateKey(d, timeZone));
    }
    return keys;
}
