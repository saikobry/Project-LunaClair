import type { SyncPullResponse, SyncPushRequest, SyncPushResponse } from './SyncTransport';

export interface ReconcilePullResult {
  appliedCount: number;
  conflictCount: number;
  newCursor: number;
}

export interface ApplyPushResult {
  acceptedCount: number;
  conflictCount: number;
}

/**
 * Domain port for local storage reconciliation during synchronization.
 *
 * Coordinates atomic batch pull application and push outcome updates.
 */
export interface SyncReconciler {
  reconcilePullBatch(
    userId: string,
    deviceId: string,
    currentCursor: number,
    pullResponse: SyncPullResponse
  ): Promise<ReconcilePullResult>;

  applyPushResult(
    userId: string,
    deviceId: string,
    pushRequest: SyncPushRequest,
    pushResponse: SyncPushResponse
  ): Promise<ApplyPushResult>;
}
