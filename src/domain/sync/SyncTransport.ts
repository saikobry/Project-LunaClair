import type {
  SessionCredentials,
  SyncCursor,
  SyncEntityType,
  SyncMutation,
  SyncOperation,
} from './sync.types';

export interface SyncPushRequest {
  deviceId: string;
  mutations: Array<SyncMutation>;
}

export interface SyncPushResponse {
  serverCursor: number;
  accepted: Array<{
    clientMutationId: string;
    entityId: string;
    entityType?: SyncEntityType | string;
    newVersion?: number;
  }>;
  conflicts: Array<{
    clientMutationId: string;
    entityId: string;
    entityType?: SyncEntityType | string;
    serverVersion: number;
    serverPayload: unknown;
  }>;
  rejected: Array<{
    clientMutationId: string;
    entityId?: string;
    entityType?: SyncEntityType | string;
    reason: string;
  }>;
}

export interface SyncPullResponse {
  newCursor: number;
  hasMore: boolean;
  changes: Array<{
    sequence: number;
    entityType: SyncEntityType;
    entityId: string;
    operation: SyncOperation;
    version?: number;
    changedAt: string;
    data: unknown;
  }>;
}

export interface SyncTransport {
  push(
    credentials: SessionCredentials,
    request: SyncPushRequest,
    signal?: AbortSignal
  ): Promise<SyncPushResponse>;

  pull(
    credentials: SessionCredentials,
    cursor: SyncCursor,
    limit?: number,
    signal?: AbortSignal
  ): Promise<SyncPullResponse>;
}
