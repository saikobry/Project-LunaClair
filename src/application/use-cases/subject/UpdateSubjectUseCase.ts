import type { SubjectRepository, UpdateSubjectInput } from '../../../domain/library/repositories/SubjectRepository';
import type { Subject } from '../../../domain/library/models/Subject';

export class UpdateSubjectUseCase {
    private readonly subjects: SubjectRepository;

    constructor(subjects: SubjectRepository) {
        this.subjects = subjects;
    }

    execute(id: string, input: UpdateSubjectInput): Promise<Subject> {
        return this.subjects.updateSubject(id, input);
    }
}
