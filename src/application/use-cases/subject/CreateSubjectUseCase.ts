import type { CreateSubjectInput, SubjectRepository } from '../../../domain/library/SubjectRepository';
import type { Subject } from '../../../domain/library/Subject';

export class CreateSubjectUseCase {
    private readonly subjects: SubjectRepository;

    constructor(subjects: SubjectRepository) {
        this.subjects = subjects;
    }

    execute(input: CreateSubjectInput): Promise<Subject> {
        return this.subjects.createSubject(input);
    }
}
