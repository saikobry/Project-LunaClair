import type { AnnotationRepository } from '../../../domain/reader/AnnotationRepository';

export class ClearAnnotationsUseCase {
    private readonly annotations: AnnotationRepository;
    constructor(annotations: AnnotationRepository) { this.annotations = annotations; }

    async execute(documentId: string, scope: 'highlights' | 'drawings' | 'all' = 'all'): Promise<void> {
        if (scope === 'highlights') return this.annotations.clearHighlights(documentId);
        if (scope === 'drawings') return this.annotations.clearDrawings(documentId);
        await Promise.all([this.annotations.clearHighlights(documentId), this.annotations.clearDrawings(documentId)]);
    }
}
