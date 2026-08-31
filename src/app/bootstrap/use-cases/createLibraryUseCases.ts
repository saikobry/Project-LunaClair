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
import type { Repositories } from '../createRepositories';

export function createLibraryUseCases(repositories: Repositories) {
    return {
        library: {
            createMaterial: new CreateMaterialUseCase(repositories.libraryRepository, repositories.subjectTermRepository),
            updateMaterial: new UpdateMaterialUseCase(repositories.libraryRepository, repositories.subjectTermRepository),
            deleteMaterial: new DeleteMaterialUseCase(repositories.libraryRepository),
            touchMaterial: new TouchMaterialUseCase(repositories.libraryRepository),
            importMaterial: new ImportMaterialUseCase(repositories.catalogRepository, repositories.quizContentRepository, repositories.documentRepository, repositories.libraryImportService),
            importSubject: new ImportSubjectUseCase(repositories.catalogRepository, repositories.libraryRepository, repositories.quizContentRepository, repositories.documentRepository, repositories.libraryImportService),
            removeImportedMaterial: new RemoveImportedMaterialUseCase(repositories.libraryImportService),
            syncDefaultTerms: new SyncDefaultTermsUseCase(repositories.catalogRepository, repositories.termRepository),
        },
        subject: {
            createSubject: new CreateSubjectUseCase(repositories.subjectRepository),
            updateSubject: new UpdateSubjectUseCase(repositories.subjectRepository),
            reorderSubjects: new ReorderSubjectsUseCase(repositories.subjectRepository),
            deleteSubject: new DeleteSubjectUseCase(repositories.subjectRepository, repositories.libraryRepository),
            createTerm: new CreateTermUseCase(repositories.termRepository),
            updateTerm: new UpdateTermUseCase(repositories.termRepository),
            deleteTerm: new DeleteTermUseCase(repositories.termRepository),
            createAndAssignTerm: new CreateAndAssignTermUseCase(repositories.termService),
            syncTerms: new SyncSubjectTermsUseCase(repositories.subjectTermRepository, repositories.termRepository),
            reorderTerms: new ReorderSubjectTermsUseCase(repositories.subjectTermRepository),
            addTerm: new AddTermToSubjectUseCase(repositories.subjectTermRepository),
            removeTerm: new RemoveTermFromSubjectUseCase(repositories.subjectTermRepository),
        },
    };
}
