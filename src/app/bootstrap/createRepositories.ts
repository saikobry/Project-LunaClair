import { localDocumentRepository } from '../../services/content/LocalDocumentRepository';
import { dexieAnnotationRepository } from '../../infrastructure/database/repositories/DexieAnnotationRepository';
import { dexieLibraryRepository } from '../../infrastructure/database/repositories/DexieLibraryRepository';
import { dexieQuestionRepository } from '../../infrastructure/database/repositories/DexieQuestionRepository';
import { dexieQuizDraftRepository } from '../../infrastructure/database/repositories/DexieQuizDraftRepository';
import { dexieQuizRepository } from '../../infrastructure/database/repositories/DexieQuizRepository';
import { dexieQuizSessionRepository } from '../../infrastructure/database/repositories/DexieQuizSessionRepository';
import { dexieSubjectRepository } from '../../infrastructure/database/repositories/DexieSubjectRepository';
import { dexieSubjectTermRepository } from '../../infrastructure/database/repositories/DexieSubjectTermRepository';
import { dexieTermRepository } from '../../infrastructure/database/repositories/DexieTermRepository';
import { dexieFlashcardReviewRepository } from '../../infrastructure/database/repositories/DexieFlashcardReviewRepository';
import { dexieQuizEditorService } from '../../infrastructure/database/services/DexieQuizEditorService';
import { dexieTermService } from '../../infrastructure/database/services/DexieTermService';

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
        quizDraftRepository: dexieQuizDraftRepository,
        quizEditorService: dexieQuizEditorService,
        flashcardReviewRepository: dexieFlashcardReviewRepository,
    };
}

export type Repositories = ReturnType<typeof createRepositories>;

