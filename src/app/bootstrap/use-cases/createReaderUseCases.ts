import { SaveHighlightUseCase } from '../../../application/use-cases/reader/SaveHighlightUseCase';
import { SaveDrawingUseCase } from '../../../application/use-cases/reader/SaveDrawingUseCase';
import { ClearAnnotationsUseCase } from '../../../application/use-cases/reader/ClearAnnotationsUseCase';
import { UpdateDocumentContentUseCase } from '../../../application/use-cases/content/UpdateDocumentContentUseCase';
import type { Infrastructure } from '../createInfrastructure';

export function createReaderUseCases(infrastructure: Infrastructure) {
    const { repositories } = infrastructure;

    return {
        reader: {
            saveHighlight: new SaveHighlightUseCase(repositories.annotation),
            saveDrawing: new SaveDrawingUseCase(repositories.annotation),
            clearAnnotations: new ClearAnnotationsUseCase(repositories.annotation),
        },
        content: {
            updateDocumentContent: new UpdateDocumentContentUseCase(repositories.documentContent),
        },
    };
}
