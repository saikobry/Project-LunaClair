export interface Collection {
    id: string;
    title: string;
    description?: string;
    icon?: string;
    color?: string;
    order: number;
    createdAt: string;
    updatedAt: string;
}

/**
 * Colour a collection renders with until the user picks one.
 *
 * Owned by the domain because every surface that shows a collection resolves
 * the same default: the collections feature (shelf, virtual shelf, hero) and the
 * materials feature (card badges). Matching the first `COLLECTION_COLOR_PRESETS`
 * swatch (Blue) keeps the persisted palette and the fallback in agreement.
 */
export const DEFAULT_COLLECTION_COLOR = '#60a5fa';

export interface CreateCollectionInput {
    title: string;
    description?: string;
    icon?: string;
    color?: string;
}

export interface UpdateCollectionInput {
    title?: string;
    description?: string;
    icon?: string;
    color?: string;
}
