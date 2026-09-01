import { describe, expect, it, vi } from 'vitest';
import { SaveHighlightUseCase } from '../SaveHighlightUseCase';
import type { AnnotationRepository } from '../../../../domain/reader/AnnotationRepository';

describe('SaveHighlightUseCase', () => {
    const createMockRepo = (): AnnotationRepository => ({
        getHighlights: vi.fn().mockResolvedValue([]),
        saveHighlights: vi.fn().mockResolvedValue(undefined),
        clearHighlights: vi.fn().mockResolvedValue(undefined),
        getDrawings: vi.fn().mockResolvedValue([]),
        saveDrawings: vi.fn().mockResolvedValue(undefined),
        clearDrawings: vi.fn().mockResolvedValue(undefined),
    });

    it('delegates saving highlights to AnnotationRepository', async () => {
        const mockRepo = createMockRepo();
        const useCase = new SaveHighlightUseCase(mockRepo);

        const highlights = [
            { id: 'h1', text: 'Important note', color: '#fef08a', cfiRange: 'epubcfi(/6/2[chap1]!/4/2)' },
        ];

        await useCase.execute('doc-101', highlights as any);

        expect(mockRepo.saveHighlights).toHaveBeenCalledWith('doc-101', highlights);
    });

    it('propagates errors when saveHighlights rejects', async () => {
        const mockRepo = createMockRepo();
        vi.mocked(mockRepo.saveHighlights).mockRejectedValue(new Error('IndexedDB quota error'));

        const useCase = new SaveHighlightUseCase(mockRepo);
        await expect(useCase.execute('doc-101', [] as any)).rejects.toThrow('IndexedDB quota error');
    });
});
