import type { ComponentType } from 'react';
import { Bookmark, Book, Folder, Sparkles, Star } from 'lucide-react';

/**
 * Collection appearance registry — shared between the create and edit modals.
 *
 * Both icons and colors are persisted as plain strings on the `Collection`
 * record so packages/data stay serializable; this module maps the names to
 * their lucide components / hex values at render time.
 */

/** Soft preset swatches (Blue, Green, Purple, Amber, Rose, Cyan). */
export const COLLECTION_COLOR_PRESETS: { name: string; hex: string }[] = [
    { name: 'Blue', hex: '#60a5fa' },
    { name: 'Green', hex: '#4ade80' },
    { name: 'Purple', hex: '#c084fc' },
    { name: 'Amber', hex: '#fbbf24' },
    { name: 'Rose', hex: '#fb7185' },
    { name: 'Cyan', hex: '#22d3ee' },
];

/** Collection icon registry — maps the persisted `icon` name to its lucide component. */
export const COLLECTION_ICONS: Record<string, ComponentType<{ size?: number | string }>> = {
    folder: Folder,
    book: Book,
    bookmark: Bookmark,
    star: Star,
    sparkles: Sparkles,
};

export const COLLECTION_ICON_NAMES = Object.keys(COLLECTION_ICONS);

/** Resolves an icon name to its lucide component (defaults to Folder). */
export function getCollectionIcon(name: string | undefined): ComponentType<{ size?: number | string }> {
    return (name && COLLECTION_ICONS[name]) || COLLECTION_ICONS.folder;
}

/**
 * Tints a persisted collection color with an alpha suffix, falling back to
 * `color-mix` for non-hex values.
 *
 * These derive from the collection's own `color` (persisted user data), not from
 * a design token — the derivation is legitimate, while the accent/token rules
 * still govern chrome that is not collection-colored.
 */
export function collectionTint(color: string, alphaHex: string, percent: number): string {
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
        return `${color}${alphaHex}`;
    }
    return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

/** Builds a subtle tinted gradient from a collection color at low opacity. */
export function collectionHeroBackground(color: string): string {
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
        return `radial-gradient(120% 160% at 0% 0%, ${color}26 0%, transparent 60%), radial-gradient(100% 140% at 100% 100%, ${color}14 0%, transparent 55%)`;
    }
    return `radial-gradient(120% 160% at 0% 0%, color-mix(in srgb, ${color} 15%, transparent) 0%, transparent 60%)`;
}
