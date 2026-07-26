import { useContext } from 'react';
import { RepositoryContext } from '../../../app/providers/RepositoryContext';
import type { AnnotationRepository } from '../../../domain/reader/AnnotationRepository';

/**
 * Dependency injection hook that returns the AnnotationRepository from context.
 * All reader feature hooks should use this to access the annotation repository
 * rather than importing concrete implementations directly.
 */
export function useAnnotationRepository(): AnnotationRepository {
    const context = useContext(RepositoryContext);
    if (!context) {
        throw new Error(
            'useAnnotationRepository must be used within a <RepositoryProvider>',
        );
    }
    return context.annotationRepository;
}
