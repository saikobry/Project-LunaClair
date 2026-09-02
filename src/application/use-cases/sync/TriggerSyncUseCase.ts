import type { SyncEngine } from '../../sync/SyncEngine';
import type { SessionCredentials } from '../../../domain/sync/models/sync.types';
import type { SessionCredentialsProvider } from '../../../domain/sync/services/SessionCredentialsProvider';

export interface TriggerSyncInput {
  credentials?: SessionCredentials;
}

/**
 * Triggers a full synchronization cycle on the SyncEngine, optionally resolving
 * active credentials from a SessionCredentialsProvider.
 */
export class TriggerSyncUseCase {
  private readonly syncEngine: SyncEngine;
  private readonly credentialsProvider?: SessionCredentialsProvider;

  constructor(syncEngine: SyncEngine, credentialsProvider?: SessionCredentialsProvider) {
    this.syncEngine = syncEngine;
    this.credentialsProvider = credentialsProvider;
  }

  async execute(input?: TriggerSyncInput): Promise<void> {
    let credentials = input?.credentials;

    if (!credentials && this.credentialsProvider) {
      credentials = (await this.credentialsProvider.getCredentials()) ?? undefined;
    }

    if (!credentials) {
      throw new Error('No session credentials available to trigger sync');
    }

    await this.syncEngine.sync(credentials);
  }
}
