import { SaveHighlightUseCase } from '../../../application/use-cases/reader/SaveHighlightUseCase';
import { SaveDrawingUseCase } from '../../../application/use-cases/reader/SaveDrawingUseCase';
import { ClearAnnotationsUseCase } from '../../../application/use-cases/reader/ClearAnnotationsUseCase';
import { UpdateDocumentContentUseCase } from '../../../application/use-cases/content/UpdateDocumentContentUseCase';
import type { Repositories } from '../createRepositories';

export function createReaderUseCases(repositories: Repositories) {
    return {
        reader: {
            saveHighlight: new SaveHighlightUseCase(repositories.annotationRepository),
            saveDrawing: new SaveDrawingUseCase(repositories.annotationRepository),
            clearAnnotations: new ClearAnnotationsUseCase(repositories.annotationRepository),
        },
        content: {
            updateDocumentContent: new UpdateDocumentContentUseCase(repositories.documentContentRepository),
        },
    };
}
