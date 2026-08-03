import { createContext } from 'react';
import type { LibraryRepository } from '../../domain/library/LibraryRepository';
import type { DocumentRepository } from '../../domain/reader/DocumentRepository';
import type { AnnotationRepository } from '../../domain/reader/AnnotationRepository';
import type { QuestionRepository } from '../../domain/quiz/QuestionRepository';
import type { QuizRepository } from '../../domain/quiz/QuizRepository';
import type { QuizSessionRepository } from '../../domain/quiz/QuizSessionRepository';
import type { SubjectRepository } from '../../domain/library/SubjectRepository';
import type { TermRepository } from '../../domain/library/TermRepository';
import type { SubjectTermRepository } from '../../domain/library/SubjectTermRepository';
import type { TermService } from '../../domain/library/TermService';

/**
 * Application-wide dependency injection context.
 *
 * Supplies both domain repositories and domain application services
 * (e.g. `termService`) to feature hooks, so feature code never imports
 * concrete Dexie implementations directly.
 */
export interface ApplicationContextValue {
  libraryRepository: LibraryRepository;
  documentRepository: DocumentRepository;
  annotationRepository: AnnotationRepository;
  questionRepository: QuestionRepository;
  quizRepository: QuizRepository;
  quizSessionRepository: QuizSessionRepository;
  subjectRepository: SubjectRepository;
  termRepository: TermRepository;
  subjectTermRepository: SubjectTermRepository;
  termService: TermService;
}

export const ApplicationContext = createContext<ApplicationContextValue | null>(null);
