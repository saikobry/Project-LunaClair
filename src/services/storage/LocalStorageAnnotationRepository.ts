import type { HighlightItem, DrawingPath } from '../../shared/types/annotation.types';
import type { AnnotationRepository } from '../../domain/reader/AnnotationRepository';
import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { getFromStorage, saveToStorage, removeFromStorage } from './localStorage';

/**
 * Migrates data from a legacy storage key to the new namespaced key.
 * Runs once per key — if the new key already has data, migration is skipped.
 */
// TODO(v1.0): Remove legacy migration after stable release.
function migrateKey<T>(legacyKey: string, newKey: string, fallback: T): T {
    const existing = getFromStorage<T | null>(newKey, null);
    if (existing !== null) return existing;

    const legacy = getFromStorage<T | null>(legacyKey, null);
    if (legacy !== null) {
        saveToStorage(newKey, legacy);
        removeFromStorage(legacyKey);
        return legacy;
    }

    return fallback;
}

export class LocalStorageAnnotationRepository implements AnnotationRepository {
    async getHighlights(_documentId: string, signal?: AbortSignal): Promise<HighlightItem[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        await Promise.resolve();
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        // TODO(v1.0): Remove legacy migration after stable release.
        return migrateKey<HighlightItem[]>(
            LEGACY_STORAGE_KEYS.highlights,
            STORAGE_KEYS.reader.highlights,
            [],
        );
    }

    async saveHighlights(_documentId: string, highlights: HighlightItem[]): Promise<void> {
        await Promise.resolve();
        saveToStorage(STORAGE_KEYS.reader.highlights, highlights);
    }

    async clearHighlights(_documentId: string): Promise<void> {
        await Promise.resolve();
        removeFromStorage(STORAGE_KEYS.reader.highlights);
    }

    async getDrawings(_documentId: string, signal?: AbortSignal): Promise<DrawingPath[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        await Promise.resolve();
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        // TODO(v1.0): Remove legacy migration after stable release.
        return migrateKey<DrawingPath[]>(
            LEGACY_STORAGE_KEYS.paths,
            STORAGE_KEYS.reader.drawings,
            [],
        );
    }

    async saveDrawings(_documentId: string, paths: DrawingPath[]): Promise<void> {
        await Promise.resolve();
        saveToStorage(STORAGE_KEYS.reader.drawings, paths);
    }

    async clearDrawings(_documentId: string): Promise<void> {
        await Promise.resolve();
        removeFromStorage(STORAGE_KEYS.reader.drawings);
    }
}

/** Singleton instance shared across the application. */
export const localStorageAnnotationRepository = new LocalStorageAnnotationRepository();
