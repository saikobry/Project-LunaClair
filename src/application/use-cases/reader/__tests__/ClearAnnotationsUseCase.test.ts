import { describe, expect, it, vi } from 'vitest';
import { ClearAnnotationsUseCase } from '../ClearAnnotationsUseCase';
import type { AnnotationRepository } from '../../../../domain/reader/repositories/AnnotationRepository';

describe('ClearAnnotationsUseCase', () => {
    const createMockRepo = (): AnnotationRepository => ({
        getHighlights: vi.fn().mockResolvedValue([]),
        saveHighlights: vi.fn().mockResolvedValue(undefined),
        clearHighlights: vi.fn().mockResolvedValue(undefined),
        getDrawings: vi.fn().mockResolvedValue([]),
        saveDrawings: vi.fn().mockResolvedValue(undefined),
        clearDrawings: vi.fn().mockResolvedValue(undefined),
    });

    it('clears only highlights when scope is "highlights"', async () => {
        const mockRepo = createMockRepo();
        const useCase = new ClearAnnotationsUseCase(mockRepo);

        await useCase.execute('doc-101', 'highlights');

        expect(mockRepo.clearHighlights).toHaveBeenCalledWith('doc-101');
        expect(mockRepo.clearDrawings).not.toHaveBeenCalled();
    });

    it('clears only drawings when scope is "drawings"', async () => {
        const mockRepo = createMockRepo();
        const useCase = new ClearAnnotationsUseCase(mockRepo);

        await useCase.execute('doc-101', 'drawings');

        expect(mockRepo.clearDrawings).toHaveBeenCalledWith('doc-101');
        expect(mockRepo.clearHighlights).not.toHaveBeenCalled();
    });

    it('clears both highlights and drawings when scope is "all" or omitted', async () => {
        const mockRepo = createMockRepo();
        const useCase = new ClearAnnotationsUseCase(mockRepo);

        await useCase.execute('doc-101');

        expect(mockRepo.clearHighlights).toHaveBeenCalledWith('doc-101');
        expect(mockRepo.clearDrawings).toHaveBeenCalledWith('doc-101');
    });
});
