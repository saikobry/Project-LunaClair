import { CreateMaterialUseCase } from '../../../application/use-cases/library/CreateMaterialUseCase';
import { UpdateMaterialUseCase } from '../../../application/use-cases/library/UpdateMaterialUseCase';
import { DeleteMaterialUseCase } from '../../../application/use-cases/library/DeleteMaterialUseCase';
import { ImportMaterialUseCase } from '../../../application/use-cases/library/ImportMaterialUseCase';
import { ImportSubjectUseCase } from '../../../application/use-cases/library/ImportSubjectUseCase';
import { RemoveImportedMaterialUseCase } from '../../../application/use-cases/library/RemoveImportedMaterialUseCase';
import { SyncDefaultTermsUseCase } from '../../../application/use-cases/library/SyncDefaultTermsUseCase';
import { TouchMaterialUseCase } from '../../../application/use-cases/library/TouchMaterialUseCase';
import { CreateSubjectUseCase } from '../../../application/use-cases/subject/CreateSubjectUseCase';
import { UpdateSubjectUseCase } from '../../../application/use-cases/subject/UpdateSubjectUseCase';
import { ReorderSubjectsUseCase } from '../../../application/use-cases/subject/ReorderSubjectsUseCase';
import { DeleteSubjectUseCase } from '../../../application/use-cases/subject/DeleteSubjectUseCase';
import { CreateTermUseCase } from '../../../application/use-cases/subject/CreateTermUseCase';
import { UpdateTermUseCase } from '../../../application/use-cases/subject/UpdateTermUseCase';
import { CreateAndAssignTermUseCase } from '../../../application/use-cases/subject/CreateAndAssignTermUseCase';
import { SyncSubjectTermsUseCase } from '../../../application/use-cases/subject/SyncSubjectTermsUseCase';
import { ReorderSubjectTermsUseCase } from '../../../application/use-cases/subject/ReorderSubjectTermsUseCase';
import { AddTermToSubjectUseCase } from '../../../application/use-cases/subject/AddTermToSubjectUseCase';
import { RemoveTermFromSubjectUseCase } from '../../../application/use-cases/subject/RemoveTermFromSubjectUseCase';
import { DeleteTermUseCase } from '../../../application/use-cases/subject/DeleteTermUseCase';
import type { Infrastructure } from '../createInfrastructure';

export function createLibraryUseCases(infrastructure: Infrastructure) {
    const { repositories, services } = infrastructure;

    return {
        library: {
            createMaterial: new CreateMaterialUseCase(repositories.library, repositories.subjectTerm),
            updateMaterial: new UpdateMaterialUseCase(repositories.library, repositories.subjectTerm),
            deleteMaterial: new DeleteMaterialUseCase(repositories.library),
            touchMaterial: new TouchMaterialUseCase(repositories.library),
            importMaterial: new ImportMaterialUseCase(repositories.catalog, repositories.quizContent, repositories.document, services.libraryImport),
            importSubject: new ImportSubjectUseCase(repositories.catalog, repositories.library, repositories.quizContent, repositories.document, services.libraryImport),
            removeImportedMaterial: new RemoveImportedMaterialUseCase(services.libraryImport),
            syncDefaultTerms: new SyncDefaultTermsUseCase(repositories.term),
        },
        subject: {
            createSubject: new CreateSubjectUseCase(repositories.subject),
            updateSubject: new UpdateSubjectUseCase(repositories.subject),
            reorderSubjects: new ReorderSubjectsUseCase(repositories.subject),
            deleteSubject: new DeleteSubjectUseCase(repositories.subject, repositories.library),
            createTerm: new CreateTermUseCase(repositories.term),
            updateTerm: new UpdateTermUseCase(repositories.term),
            deleteTerm: new DeleteTermUseCase(repositories.term),
            createAndAssignTerm: new CreateAndAssignTermUseCase(services.term),
            syncTerms: new SyncSubjectTermsUseCase(repositories.subjectTerm, repositories.term),
            reorderTerms: new ReorderSubjectTermsUseCase(repositories.subjectTerm),
            addTerm: new AddTermToSubjectUseCase(repositories.subjectTerm),
            removeTerm: new RemoveTermFromSubjectUseCase(repositories.subjectTerm),
        },
    };
}
