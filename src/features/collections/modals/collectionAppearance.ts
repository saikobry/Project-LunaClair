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
