import { describe, expect, it, vi } from 'vitest';
import { UpdateSubjectUseCase } from '../UpdateSubjectUseCase';
import type { SubjectRepository, UpdateSubjectInput } from '../../../../domain/library/SubjectRepository';
import type { Subject } from '../../../../domain/library/Subject';

describe('UpdateSubjectUseCase', () => {
    const mockSubject: Subject = {
        id: 'sub-1',
        title: 'Organic Chemistry',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('updates subject title and description', async () => {
        const mockRepo: SubjectRepository = {
            updateSubject: vi.fn().mockImplementation((id, input) =>
                Promise.resolve({
                    ...mockSubject,
                    id,
                    ...input,
                }),
            ),
            getSubjects: vi.fn(),
            getSubjectById: vi.fn(),
            createSubject: vi.fn(),
            deleteSubject: vi.fn(),
            reorderSubjects: vi.fn(),
        };

        const useCase = new UpdateSubjectUseCase(mockRepo);
        const input: UpdateSubjectInput = { title: 'Advanced Organic Chemistry' };

        const result = await useCase.execute('sub-1', input);

        expect(mockRepo.updateSubject).toHaveBeenCalledWith('sub-1', input);
        expect(result.title).toBe('Advanced Organic Chemistry');
    });
});
