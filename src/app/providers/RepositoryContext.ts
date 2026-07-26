import { createContext } from 'react';
import type { LibraryRepository } from '../../domain/library/LibraryRepository';
import type { DocumentRepository } from '../../domain/reader/DocumentRepository';
import type { AnnotationRepository } from '../../domain/reader/AnnotationRepository';
import type { QuestionRepository } from '../../domain/quiz/QuestionRepository';
import type { QuizRepository } from '../../domain/quiz/QuizRepository';
import type { QuizSessionRepository } from '../../domain/quiz/QuizSessionRepository';

export interface RepositoryContextValue {
    libraryRepository: LibraryRepository;
    documentRepository: DocumentRepository;
    annotationRepository: AnnotationRepository;
    questionRepository: QuestionRepository;
    quizRepository: QuizRepository;
    quizSessionRepository: QuizSessionRepository;
}

export const RepositoryContext = createContext<RepositoryContextValue | null>(null);
