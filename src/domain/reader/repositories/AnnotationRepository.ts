import type { HighlightItem, DrawingPath } from '../models/annotation.types';

/**
 * Async contract for annotation persistence (highlights + drawings).
 * Implementations must satisfy all methods with AbortSignal support.
 */
export interface AnnotationRepository {
    /**
     * Retrieves text highlights for a document.
     * @param documentId - Reserved for future multi-document annotation scoping.
     */
    getHighlights(documentId: string, signal?: AbortSignal): Promise<HighlightItem[]>;

    /**
     * Persists the full highlights array for a document.
     * @param documentId - Reserved for future multi-document annotation scoping.
     */
    saveHighlights(documentId: string, highlights: HighlightItem[]): Promise<void>;

    /**
     * Removes all highlights for a document.
     * @param documentId - Reserved for future multi-document annotation scoping.
     */
    clearHighlights(documentId: string): Promise<void>;

    /**
     * Retrieves drawing paths for a document.
     * @param documentId - Reserved for future multi-document annotation scoping.
     */
    getDrawings(documentId: string, signal?: AbortSignal): Promise<DrawingPath[]>;

    /**
     * Persists the full drawing paths array for a document.
     * @param documentId - Reserved for future multi-document annotation scoping.
     */
    saveDrawings(documentId: string, paths: DrawingPath[]): Promise<void>;

    /**
     * Removes all drawings for a document.
     * @param documentId - Reserved for future multi-document annotation scoping.
     */
    clearDrawings(documentId: string): Promise<void>;
}
