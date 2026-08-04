import type { HighlightItem, DrawingPath } from '../../domain/reader';
import type { AnnotationRepository } from '../../domain/reader/AnnotationRepository';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { getFromStorage, saveToStorage, removeFromStorage } from './localStorage';

export class LocalStorageAnnotationRepository implements AnnotationRepository {
    async getHighlights(_documentId: string, signal?: AbortSignal): Promise<HighlightItem[]> {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        await Promise.resolve();
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        return getFromStorage<HighlightItem[]>(STORAGE_KEYS.reader.highlights, []);
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

        return getFromStorage<DrawingPath[]>(STORAGE_KEYS.reader.drawings, []);
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
