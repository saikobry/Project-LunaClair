import { createContext } from 'react';
import type { LibraryRepository } from '../../domain/library/LibraryRepository';
import type { DocumentRepository } from '../../domain/reader/DocumentRepository';
import type { AnnotationRepository } from '../../domain/reader/AnnotationRepository';

export interface RepositoryContextValue {
    libraryRepository: LibraryRepository;
    documentRepository: DocumentRepository;
    annotationRepository: AnnotationRepository;
}

export const RepositoryContext = createContext<RepositoryContextValue | null>(null);
