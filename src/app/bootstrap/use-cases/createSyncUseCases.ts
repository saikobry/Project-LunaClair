import { SyncEngine } from '../../../application/sync/SyncEngine';
import { syncStatusStore } from '../../../application/sync/SyncStatusStore';
import { GetSyncStatusUseCase } from '../../../application/use-cases/sync/GetSyncStatusUseCase';
import { GetConflictDraftsUseCase } from '../../../application/use-cases/sync/GetConflictDraftsUseCase';
import { ResolveConflictDraftUseCase } from '../../../application/use-cases/sync/ResolveConflictDraftUseCase';
import { TriggerSyncUseCase } from '../../../application/use-cases/sync/TriggerSyncUseCase';
import type { Repositories } from '../createRepositories';

export function createSyncUseCases(repositories: Repositories) {
    const syncEngine = new SyncEngine(
        repositories.db,
        repositories.workerSyncTransport,
        repositories.dexieSyncReconciler,
        repositories.syncQueueRepository,
        repositories.syncStateRepository,
        syncStatusStore,
    );

    const getSyncStatus = new GetSyncStatusUseCase(syncStatusStore);
    const getConflictDrafts = new GetConflictDraftsUseCase(repositories.conflictDraftRepository);
    const resolveConflictDraft = new ResolveConflictDraftUseCase(
        repositories.db,
        repositories.conflictDraftRepository,
    );
    const triggerSync = new TriggerSyncUseCase(
        syncEngine,
        repositories.credentialsProvider,
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
