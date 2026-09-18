import { useContext } from 'react';
import { ApplicationContext } from '../../../app/providers/ApplicationContext';
import type { AssetRepository } from '../../../domain/assets/repositories/AssetRepository';

/**
 * Dependency injection hook that returns the AssetRepository from context.
 *
 * The port is read-only, so the reader resolves locally stored binary assets and never writes
 * them.
 */
export function useAssetRepository(): AssetRepository {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error(
            'useAssetRepository must be used within a <ApplicationProvider>',
        );
    }
    return context.repositories.asset;
}
