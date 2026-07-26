import type { HighlightItem, DrawingPath } from '../../shared/types/annotation.types';

export interface AnnotationRepository {
    getHighlights(documentId: string, signal?: AbortSignal): Promise<HighlightItem[]>;
    saveHighlights(documentId: string, highlights: HighlightItem[]): Promise<void>;
    clearHighlights(documentId: string): Promise<void>;
    getDrawings(documentId: string, signal?: AbortSignal): Promise<DrawingPath[]>;
    saveDrawings(documentId: string, paths: DrawingPath[]): Promise<void>;
    clearDrawings(documentId: string): Promise<void>;
}
