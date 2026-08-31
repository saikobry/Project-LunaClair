import { useContext } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import type { DocumentRepository } from '../../../domain/reader/DocumentRepository';

/**
 * Dependency injection hook that returns the DocumentRepository from context.
 * All reader feature hooks should use this to access the document repository
 * rather than importing concrete implementations directly.
 */
export function useDocumentRepository(): DocumentRepository {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error(
            'useDocumentRepository must be used within a <ApplicationProvider>',
        );
    }
    return context.repositories.document;
}
