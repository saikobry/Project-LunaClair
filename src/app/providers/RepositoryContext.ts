import { createContext } from 'react';
import type { LibraryRepository } from '../../domain/library/LibraryRepository';

export interface RepositoryContextValue {
    libraryRepository: LibraryRepository;
}

export const RepositoryContext = createContext<RepositoryContextValue | null>(null);
