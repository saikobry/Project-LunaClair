import { SyncEngine } from '../../../application/sync/SyncEngine';
import { syncStatusStore } from '../../../application/sync/SyncStatusStore';
import { GetSyncStatusUseCase } from '../../../application/use-cases/sync/GetSyncStatusUseCase';
import { GetConflictDraftsUseCase } from '../../../application/use-cases/sync/GetConflictDraftsUseCase';
import { ResolveConflictDraftUseCase } from '../../../application/use-cases/sync/ResolveConflictDraftUseCase';
import { TriggerSyncUseCase } from '../../../application/use-cases/sync/TriggerSyncUseCase';
import type { SessionCredentialsProvider } from '../../../domain/sync/services/SessionCredentialsProvider';
import type { Infrastructure, Repositories } from '../createInfrastructure';
import { withOrigin } from '../../../infrastructure/database/sync/transactionContext';
import { getTablesForCategory } from '../../../domain/sync/policy/SyncPolicy';
import {
    syncCategoryPreferences,
    type SyncCategoryKey,
} from '../../../domain/sync/preferences/SyncCategoryPreferences';

export interface SyncUseCasesDependencies {
    syncEngine: SyncEngine;
    credentialsProvider?: SessionCredentialsProvider;
    conflictDraftRepository?: Repositories['conflictDraft'];
}

export function createSyncUseCases(
    infrastructureOrDeps: Infrastructure | SyncUseCasesDependencies,
) {
    if ('providers' in infrastructureOrDeps && 'transports' in infrastructureOrDeps) {
        const { transports, syncReconciler, repositories, providers, db } = infrastructureOrDeps;

        const syncEngine = new SyncEngine(
            transports.sync,
            syncReconciler,
            repositories.syncQueue,
            repositories.syncState,
            syncStatusStore,
        );

        const getSyncStatus = new GetSyncStatusUseCase(syncStatusStore);
        const getConflictDrafts = new GetConflictDraftsUseCase(repositories.conflictDraft);
        const resolveConflictDraft = new ResolveConflictDraftUseCase(
            repositories.conflictDraft,
        );
        const triggerSync = new TriggerSyncUseCase(
            syncEngine,
            providers.credentials,
        );
        const toggleCategory = {
            execute: async (category: SyncCategoryKey, enabled: boolean): Promise<void> => {
                if (!enabled && db) {
                    const tableNames = getTablesForCategory(category);
                    const tables = tableNames
                        .map((name) => (db.tables.some((t) => t.name === name) ? db.table(name) : undefined))
                        .filter((t): t is NonNullable<typeof t> => Boolean(t));
                    if (tables.length > 0) {
                        await withOrigin(db, 'bypass', tables, async () => {
                            // Maintenance scope under bypass: emits zero outbox rows and zero tombstones
                        });
                    }
                }
                syncCategoryPreferences.setCategoryEnabled(category, enabled);
            },
        };

        return {
            syncEngine,
            syncStatusStore,
            getSyncStatus,
            getConflictDrafts,
            resolveConflictDraft,
            triggerSync,
            toggleCategory,
        };
    }

    const { syncEngine, credentialsProvider, conflictDraftRepository } = infrastructureOrDeps;
    return {
        syncEngine,
        syncStatusStore,
        getSyncStatus: new GetSyncStatusUseCase(syncStatusStore),
        getConflictDrafts: conflictDraftRepository
            ? new GetConflictDraftsUseCase(conflictDraftRepository)
            : undefined,
        resolveConflictDraft: conflictDraftRepository
            ? new ResolveConflictDraftUseCase(conflictDraftRepository)
            : undefined,
        triggerSync: new TriggerSyncUseCase(syncEngine, credentialsProvider),
        toggleCategory: {
            execute: async (category: SyncCategoryKey, enabled: boolean): Promise<void> => {
                syncCategoryPreferences.setCategoryEnabled(category, enabled);
            },
        },
    };
}

