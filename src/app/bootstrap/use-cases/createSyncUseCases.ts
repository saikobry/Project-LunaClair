import { SyncEngine } from '../../../application/sync/SyncEngine';
import { syncStatusStore } from '../../../application/sync/SyncStatusStore';
import { GetSyncStatusUseCase } from '../../../application/use-cases/sync/GetSyncStatusUseCase';
import { GetConflictDraftsUseCase } from '../../../application/use-cases/sync/GetConflictDraftsUseCase';
import { ResolveConflictDraftUseCase } from '../../../application/use-cases/sync/ResolveConflictDraftUseCase';
import { TriggerSyncUseCase } from '../../../application/use-cases/sync/TriggerSyncUseCase';
import type { Infrastructure } from '../createInfrastructure';

export function createSyncUseCases(infrastructure: Infrastructure) {
    const { db, transports, syncReconciler, repositories, providers } = infrastructure;

    const syncEngine = new SyncEngine(
        db,
        transports.sync,
        syncReconciler,
        repositories.syncQueue,
        repositories.syncState,
        syncStatusStore,
    );

    const getSyncStatus = new GetSyncStatusUseCase(syncStatusStore);
    const getConflictDrafts = new GetConflictDraftsUseCase(repositories.conflictDraft);
    const resolveConflictDraft = new ResolveConflictDraftUseCase(
        db,
        repositories.conflictDraft,
    );
    const triggerSync = new TriggerSyncUseCase(
        syncEngine,
        providers.credentials,
    );

    return {
        syncEngine,
        syncStatusStore,
        getSyncStatus,
        getConflictDrafts,
        resolveConflictDraft,
        triggerSync,
    };
}
