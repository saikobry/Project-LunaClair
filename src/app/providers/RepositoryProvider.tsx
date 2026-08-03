import { useRef, type ReactNode } from 'react';
import { RepositoryContext, type RepositoryContextValue } from './RepositoryContext';
import { localDocumentRepository } from '../../services/content/LocalDocumentRepository';
import { dexieLibraryRepository } from '../../infrastructure/database/repositories/DexieLibraryRepository';
import { dexieAnnotationRepository } from '../../infrastructure/database/repositories/DexieAnnotationRepository';
import { dexieQuestionRepository } from '../../infrastructure/database/repositories/DexieQuestionRepository';
import { dexieQuizRepository } from '../../infrastructure/database/repositories/DexieQuizRepository';
import { dexieQuizSessionRepository } from '../../infrastructure/database/repositories/DexieQuizSessionRepository';
import { dexieSubjectRepository } from '../../infrastructure/database/repositories/DexieSubjectRepository';
import { dexieTermRepository } from '../../infrastructure/database/repositories/DexieTermRepository';
import { dexieSubjectTermRepository } from '../../infrastructure/database/repositories/DexieSubjectTermRepository';

interface RepositoryProviderProps {
  children: ReactNode;
}

/**
 * Provides all domain repositories to feature hooks via React context.
 * Repository instances are stable singletons that never recreate across re-renders.
 */
export function RepositoryProvider({ children }: RepositoryProviderProps) {
  const ref = useRef<RepositoryContextValue>({
    libraryRepository: dexieLibraryRepository,
    documentRepository: localDocumentRepository,
    annotationRepository: dexieAnnotationRepository,
    questionRepository: dexieQuestionRepository,
    quizRepository: dexieQuizRepository,
    quizSessionRepository: dexieQuizSessionRepository,
    subjectRepository: dexieSubjectRepository,
    termRepository: dexieTermRepository,
    subjectTermRepository: dexieSubjectTermRepository,
  });

  return (
    <RepositoryContext.Provider value={ref.current}>
      {children}
    </RepositoryContext.Provider>
  );
}
