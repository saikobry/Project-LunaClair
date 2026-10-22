import type { Infrastructure, Repositories } from './createInfrastructure';
import { createInfrastructure, createInfrastructureAsync } from './createInfrastructure';
import type { UseCases } from './createUseCases';
import { createUseCases } from './createUseCases';
import {
    noopAnalyticsCacheInvalidator,
    type AnalyticsCacheInvalidator,
} from './analyticsInvalidation';
import type { LunaClairDatabase } from '../../infrastructure/database/schema/LunaClairDatabase';
import type { SyncEventSink } from '../../application/sync/SyncEventSink';

/**
 * Top-level application container exposed to the React UI via ApplicationContext.
 * Features consume capabilities directly from `repositories` (pure data access)
 * and `useCases` (application intent & state transitions).
 *
 * `infrastructure` remains available for internal bootstrap & shell-level orchestration.
 */
export interface Application {
    repositories: Repositories;
    useCases: UseCases;
    infrastructure: Infrastructure;
    isDisposed?: boolean;
    dispose?: () => void;
}

/**
 * LunaClair Composition Root.
 * Composes the entire dependency graph as stable singletons.
 *
 * `invalidateAnalytics` is the composition boundary's cross-feature cache hook:
 * it is threaded into the question repository and the quiz canvas save so a
 * question write or delete recomputes the `['analytics']` pool, without either
 * authoring feature importing the analytics feature. `ApplicationProvider`
 * binds it to the app's `QueryClient`.
 *
 * `syncEventSink` connects remote sync change events with UI query cache
 * invalidation outside Dexie transactions.
 */
export function createApplication(
    invalidateAnalytics: AnalyticsCacheInvalidator = noopAnalyticsCacheInvalidator,
    database?: LunaClairDatabase,
    syncEventSink?: SyncEventSink,
): Application {
    const infrastructure = createInfrastructure(invalidateAnalytics, database);
    const useCases = createUseCases(infrastructure, invalidateAnalytics, syncEventSink);

    let isDisposed = false;
    const dispose = () => {
        if (isDisposed) return;
        isDisposed = true;
        useCases.sync.syncEngine.dispose();
        infrastructure.services.hydration.dispose();
        infrastructure.dispose?.();
    };

    return {
        repositories: infrastructure.repositories,
        useCases,
        infrastructure,
        get isDisposed() {
            return isDisposed;
        },
        dispose,
    };
}

/**
 * Asynchronous Composition Root.
 * Resolves the active vault pointer from `VaultRegistry`, binds the active database,
 * and composes the application container.
 */
export async function createApplicationAsync(
    invalidateAnalytics: AnalyticsCacheInvalidator = noopAnalyticsCacheInvalidator,
    preferredSub?: string,
    syncEventSink?: SyncEventSink,
): Promise<Application> {
    const infrastructure = await createInfrastructureAsync(invalidateAnalytics, preferredSub);
    const useCases = createUseCases(infrastructure, invalidateAnalytics, syncEventSink);

    let isDisposed = false;
    const dispose = () => {
        if (isDisposed) return;
        isDisposed = true;
        useCases.sync.syncEngine.dispose();
        infrastructure.services.hydration.dispose();
        infrastructure.dispose?.();
    };

    return {
        repositories: infrastructure.repositories,
        useCases,
        infrastructure,
        get isDisposed() {
            return isDisposed;
        },
        dispose,
    };
}
