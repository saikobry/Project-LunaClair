import type {
  SessionCredentials,
  SyncCursor,
  SyncPushRequest,
  SyncPushResponse,
  SyncPullResponse,
} from '../models/sync.types';

export type { SyncPushRequest, SyncPushResponse, SyncPullResponse };

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
