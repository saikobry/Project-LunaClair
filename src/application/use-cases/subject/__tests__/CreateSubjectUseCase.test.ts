import { describe, expect, it, vi } from 'vitest';
import { CreateSubjectUseCase } from '../CreateSubjectUseCase';
import type { SubjectRepository, CreateSubjectInput } from '../../../../domain/library/SubjectRepository';
import type { Subject } from '../../../../domain/library/Subject';

describe('CreateSubjectUseCase', () => {
    const mockSubject: Subject = {
        id: 'sub-1',
        title: 'Organic Chemistry',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('creates and returns a new subject entity', async () => {
        const mockRepo: SubjectRepository = {
            createSubject: vi.fn().mockResolvedValue(mockSubject),
            getSubjects: vi.fn(),
            getSubjectById: vi.fn(),
            updateSubject: vi.fn(),
            deleteSubject: vi.fn(),
            reorderSubjects: vi.fn(),
        };

        const useCase = new CreateSubjectUseCase(mockRepo);
        const input: CreateSubjectInput = { title: 'Organic Chemistry' };

        const result = await useCase.execute(input);

        expect(mockRepo.createSubject).toHaveBeenCalledWith(input);
        expect(result).toEqual(mockSubject);
    });
});
