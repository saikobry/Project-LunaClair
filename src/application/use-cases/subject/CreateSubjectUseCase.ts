import type { CreateSubjectInput, SubjectRepository } from '../../../domain/library/repositories/SubjectRepository';
import type { Subject } from '../../../domain/library/models/Subject';

export class CreateSubjectUseCase {
    private readonly subjects: SubjectRepository;

    constructor(subjects: SubjectRepository) {
        this.subjects = subjects;
    }

    execute(input: CreateSubjectInput): Promise<Subject> {
        return this.subjects.createSubject(input);
    }
}
