import type { SubjectRepository } from '../../../domain/library/SubjectRepository';

export class ReorderSubjectsUseCase {
    private readonly subjects: SubjectRepository;

    constructor(subjects: SubjectRepository) {
        this.subjects = subjects;
    }

    execute(orderedIds: string[]): Promise<void> {
        return this.subjects.reorderSubjects(orderedIds);
    }
}
