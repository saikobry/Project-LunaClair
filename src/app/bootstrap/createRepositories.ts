import { localDocumentRepository } from '../../services/content/LocalDocumentRepository';
import { dexieAnnotationRepository, dexieLibraryRepository, dexieQuestionRepository, dexieQuizRepository, dexieQuizSessionRepository, dexieSubjectRepository, dexieSubjectTermRepository, dexieTermRepository, dexieTermService } from '../../infrastructure/database';

export function createRepositories() {
    return {
        documentRepository: localDocumentRepository,
        annotationRepository: dexieAnnotationRepository,
        libraryRepository: dexieLibraryRepository,
        questionRepository: dexieQuestionRepository,
        quizRepository: dexieQuizRepository,
        quizSessionRepository: dexieQuizSessionRepository,
        subjectRepository: dexieSubjectRepository,
        termRepository: dexieTermRepository,
        subjectTermRepository: dexieSubjectTermRepository,
        termService: dexieTermService,
    };
}

export type Repositories = ReturnType<typeof createRepositories>;
