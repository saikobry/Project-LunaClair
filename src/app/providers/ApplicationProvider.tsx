import { useRef, type ReactNode } from 'react';
import { ApplicationContext, type ApplicationContextValue } from './ApplicationContext';
import { localDocumentRepository } from '../../services/content/LocalDocumentRepository';
import { dexieLibraryRepository } from '../../infrastructure/database/repositories/DexieLibraryRepository';
import { dexieAnnotationRepository } from '../../infrastructure/database/repositories/DexieAnnotationRepository';
import { dexieQuestionRepository } from '../../infrastructure/database/repositories/DexieQuestionRepository';
import { dexieQuizRepository } from '../../infrastructure/database/repositories/DexieQuizRepository';
import { dexieQuizSessionRepository } from '../../infrastructure/database/repositories/DexieQuizSessionRepository';
import { dexieSubjectRepository } from '../../infrastructure/database/repositories/DexieSubjectRepository';
import { dexieTermRepository } from '../../infrastructure/database/repositories/DexieTermRepository';
import { dexieSubjectTermRepository } from '../../infrastructure/database/repositories/DexieSubjectTermRepository';
import { dexieTermService } from '../../infrastructure/database/services/DexieTermService';

interface ApplicationProviderProps {
  children: ReactNode;
}

/**
 * Provides all domain repositories and application services to feature
 * hooks via React context. Instances are stable singletons that never
 * recreate across re-renders.
 */
export function ApplicationProvider({ children }: ApplicationProviderProps) {
  const ref = useRef<ApplicationContextValue>({
    libraryRepository: dexieLibraryRepository,
    documentRepository: localDocumentRepository,
    annotationRepository: dexieAnnotationRepository,
    questionRepository: dexieQuestionRepository,
    quizRepository: dexieQuizRepository,
    quizSessionRepository: dexieQuizSessionRepository,
    subjectRepository: dexieSubjectRepository,
    termRepository: dexieTermRepository,
    subjectTermRepository: dexieSubjectTermRepository,
    termService: dexieTermService,
  });

  return (
    <ApplicationContext.Provider value={ref.current}>
      {children}
    </ApplicationContext.Provider>
  );
}
