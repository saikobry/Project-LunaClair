import type { AnnotationRepository } from '../../../domain/reader/AnnotationRepository';
type DrawingPaths = Parameters<AnnotationRepository['saveDrawings']>[1];
export class SaveDrawingUseCase { private readonly annotations: AnnotationRepository; constructor(annotations: AnnotationRepository) { this.annotations = annotations; } execute(documentId: string, paths: DrawingPaths): Promise<void> { return this.annotations.saveDrawings(documentId, paths); } }
