import type { AnnotationRepository } from '../../../domain/reader/repositories/AnnotationRepository';
type Highlights = Parameters<AnnotationRepository['saveHighlights']>[1];
export class SaveHighlightUseCase { private readonly annotations: AnnotationRepository; constructor(annotations: AnnotationRepository) { this.annotations = annotations; } execute(documentId: string, highlights: Highlights): Promise<void> { return this.annotations.saveHighlights(documentId, highlights); } }
