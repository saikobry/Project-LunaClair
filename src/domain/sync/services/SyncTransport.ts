import type {
  SessionCredentials,
  SyncCursor,
  SyncPushRequest,
  SyncPushResponse,
  SyncPullResponse,
  PullReceipt,
} from '../models/sync.types';

export type { SyncPushRequest, SyncPushResponse, SyncPullResponse, PullReceipt };

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

  acknowledgePull?(
    credentials: SessionCredentials,
    receipt: PullReceipt,
    signal?: AbortSignal
  ): Promise<void>;
}
