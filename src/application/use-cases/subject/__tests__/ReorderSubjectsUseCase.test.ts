import { describe, expect, it, vi } from 'vitest';
import { ReorderSubjectsUseCase } from '../ReorderSubjectsUseCase';
import type { SubjectRepository } from '../../../../domain/library/SubjectRepository';

describe('ReorderSubjectsUseCase', () => {
    it('delegates ordered ID array to SubjectRepository', async () => {
        const mockRepo: SubjectRepository = {
            reorderSubjects: vi.fn().mockResolvedValue(undefined),
            getSubjects: vi.fn(),
            getSubjectById: vi.fn(),
            createSubject: vi.fn(),
            updateSubject: vi.fn(),
            deleteSubject: vi.fn(),
        };

        const useCase = new ReorderSubjectsUseCase(mockRepo);
        await useCase.execute(['sub-2', 'sub-1', 'sub-3']);

        expect(mockRepo.reorderSubjects).toHaveBeenCalledWith(['sub-2', 'sub-1', 'sub-3']);
    });
});
