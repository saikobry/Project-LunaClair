import { describe, expect, it, vi } from 'vitest';
import { SaveDrawingUseCase } from '../SaveDrawingUseCase';
import type { AnnotationRepository } from '../../../../domain/reader/repositories/AnnotationRepository';

describe('SaveDrawingUseCase', () => {
    const createMockRepo = (): AnnotationRepository => ({
        getHighlights: vi.fn().mockResolvedValue([]),
        saveHighlights: vi.fn().mockResolvedValue(undefined),
        clearHighlights: vi.fn().mockResolvedValue(undefined),
        getDrawings: vi.fn().mockResolvedValue([]),
        saveDrawings: vi.fn().mockResolvedValue(undefined),
        clearDrawings: vi.fn().mockResolvedValue(undefined),
    });

    it('delegates saving drawing paths to AnnotationRepository', async () => {
        const mockRepo = createMockRepo();
        const useCase = new SaveDrawingUseCase(mockRepo);

        const paths = [
            { id: 'p1', points: [{ x: 10, y: 20 }, { x: 30, y: 40 }], color: '#ef4444', width: 2 },
        ];

        await useCase.execute('doc-101', paths as any);

        expect(mockRepo.saveDrawings).toHaveBeenCalledWith('doc-101', paths);
    });
});
