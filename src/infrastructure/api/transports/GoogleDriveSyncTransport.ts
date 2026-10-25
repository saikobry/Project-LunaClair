/**
 * Google Drive synchronization transport implementing BYOS single-writer
 * append-only journal sync per ADR-018.
 *
 * Persists local mutations to compressed journal files (journal_{hlc}_{deviceId}.json.gz)
 * in Google Drive appDataFolder and ingests peer changes using the changes feed.
 */
import type {
  SessionCredentials,
  SyncChangeItem,
  SyncCursor,
  SyncMutation,
  SyncPushRequest,
  SyncPushResponse,
  SyncState,
  PullReceipt,
  PullFileProgress,
  PendingDiscoveryState,
} from '../../../domain/sync/models/sync.types';
import type {
  SyncPullResponse,
  SyncTransport,
} from '../../../domain/sync/services/SyncTransport';
import type {
  DriveFileMetadata,
  DriveChangesResponse,
  GoogleDrivePort,
  Recover410Params,
  CursorRecoveryResult,
} from '../../../domain/drive/models/drive.types';
import { DriveHttpError, DriveAuthError } from '../../../domain/drive/models/drive.types';
import type { GoogleAuthPort } from '../../../domain/auth/models/auth.types';
import { googleDriveClient } from '../google/GoogleDriveClient';
import { googleAuthService } from '../../auth/google/GoogleAuthService';
import {
  createHlc,
  compareHlc,
  FLOOR_ISO,
  type HybridLogicalClock,
} from '../../../domain/sync/utils/hlc';
import type { SyncStateRepository } from '../../../domain/sync/repositories/SyncStateRepository';
import { dexieSyncStateRepository } from '../../database/repositories/DexieSyncStateRepository';
import { getActiveVaultDatabase, type LunaClairDatabase } from '../../database/schema/LunaClairDatabase';
import {
  collectVaultChunksGzipped,
  deriveEntityHlc,
  paginateTable,
} from '../google/streamVaultChunksGzipped';
import type { SyncPointerPayload } from '../../../domain/sync/models/SyncPointer';
import type { HydrationManager } from '../../sync/HydrationManager';

export interface JournalPayload {
  hlc: string;
  deviceId: string;
  createdAt: string;
  mutations: SyncMutation[];
}

export interface PendingBatchCandidate {
  fileId: string;
  metadata: DriveFileMetadata;
  journal?: JournalPayload;
}

export interface PendingBatch {
  tokenKey: string;
  pendingTokenToCommit?: string;
  changesResponseHasMorePages: boolean;
  candidates: PendingBatchCandidate[];
  completedCandidateFileIds: Set<string>;
  allCandidateFileIds?: string[];
}

export const MAX_PERSISTED_APPLIED_FILES = 1000;

export interface GoogleDriveSyncTransportOptions {
  driveClient?: GoogleDrivePort;
  authService?: GoogleAuthPort;
  hlc?: HybridLogicalClock;
  stateRepo?: SyncStateRepository;
  db?: LunaClairDatabase;
  onTokenExpired?: () => Promise<string>;
  hydrationManager?: HydrationManager;
  expectedSub?: string;
}

export class GoogleDriveSyncTransport implements SyncTransport {
  private readonly driveClient: GoogleDrivePort;
  private readonly authService: GoogleAuthPort;
  private readonly stateRepo: SyncStateRepository;
  private readonly db: LunaClairDatabase;
  private hydrationManager?: HydrationManager;
  private readonly expectedSub?: string;
  private readonly abortController: AbortController;
  private readonly activeControllers = new Set<AbortController>();
  private authUnsubscribe?: () => void;
  private disposed: boolean;
  private currentActiveUserId?: string;
  private readonly hlcs: Map<string, HybridLogicalClock>;
  private readonly pageTokens: Map<string, string>;
  private readonly appliedFileIds: Set<string>;
  private readonly peerWatermarks: Record<string, string>;
  private currentSequence: number;
  private pushSequence: number;
  private driveSeeded: boolean;
  private currentCheckpointRevision: number;
  private pendingFileProgress?: PullFileProgress;
  private pendingDiscoveryState?: PendingDiscoveryState;
  private pendingBatch?: PendingBatch;

  constructor(options: GoogleDriveSyncTransportOptions = {}) {
    this.driveClient = options.driveClient ?? googleDriveClient;
    this.authService = options.authService ?? googleAuthService;
    this.stateRepo = options.stateRepo ?? dexieSyncStateRepository;
    this.db = options.db ?? getActiveVaultDatabase();
    this.hydrationManager = options.hydrationManager;
    this.expectedSub = options.expectedSub;
    this.abortController = new AbortController();
    this.disposed = false;
    this.hlcs = new Map();
    if (options.hlc) {
      this.hlcs.set('default', options.hlc);
    }
    this.pageTokens = new Map();
    this.appliedFileIds = new Set();
    this.peerWatermarks = {};
    this.currentSequence = 0;
    this.pushSequence = 0;
    this.driveSeeded = false;
    this.currentCheckpointRevision = 0;

    // Wire automatic token refresh callback on HTTP 401
    const refreshCallback = options.onTokenExpired ?? (async (): Promise<string> => {
      const targetSub = this.currentActiveUserId ?? this.expectedSub;
      if (typeof this.authService.refreshAccessToken === 'function' && !targetSub) {
        return this.authService.refreshAccessToken();
      }
      if (targetSub !== undefined) {
        return (this.authService as any).getValidAccessToken(true, targetSub);
      }
      return this.authService.getValidAccessToken(true);
    });

    if (typeof this.driveClient.setOnTokenExpired === 'function') {
      this.driveClient.setOnTokenExpired(refreshCallback);
    } else if ('onTokenExpired' in this.driveClient) {
      this.driveClient.onTokenExpired = refreshCallback;
    }
  }

  abortActiveTransports(reason: Error = new Error('Transport operation aborted')): void {
    for (const ctrl of this.activeControllers) {
      try {
        ctrl.abort(reason);
      } catch {
        // Ignore
      }
    }
    this.activeControllers.clear();
  }

  dispose(): void {
    this.disposed = true;
    this.authUnsubscribe?.();
    this.abortActiveTransports(new Error('GoogleDriveSyncTransport is disposed'));
    this.abortController.abort();
    this.clearState();
  }

  private combineSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    for (const s of signals) {
      if (s.aborted) {
        controller.abort(s.reason);
        return controller.signal;
      }
      s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
    }
    return controller.signal;
  }

  private getCombinedSignal(signal?: AbortSignal, additionalSignal?: AbortSignal): AbortSignal {
    const signals: AbortSignal[] = [this.abortController.signal];
    if (signal) signals.push(signal);
    if (additionalSignal) signals.push(additionalSignal);
    if (typeof AbortSignal.any === 'function') {
      return AbortSignal.any(signals);
    }
    return this.combineSignals(signals);
  }

  setHydrationManager(manager: HydrationManager): void {
    this.hydrationManager = manager;
  }

  /**
   * Pushes local mutations by packaging them into an append-only compressed
   * journal file uploaded to Google Drive appDataFolder.
   */
  async push(
    credentials: SessionCredentials,
    request: SyncPushRequest,
    signal?: AbortSignal
  ): Promise<SyncPushResponse> {
    if (this.disposed || this.abortController.signal.aborted) {
      throw new Error('GoogleDriveSyncTransport is disposed');
    }
    if (this.expectedSub && credentials.userId !== this.expectedSub) {
      throw new DriveAuthError(
        `Account mismatch: expected ${this.expectedSub} but received ${credentials.userId}`
      );
    }

    const requestController = new AbortController();
    this.activeControllers.add(requestController);
    const effectiveSignal = this.getCombinedSignal(signal, requestController.signal);
    effectiveSignal.throwIfAborted();

    if (!request.mutations || request.mutations.length === 0) {
      this.activeControllers.delete(requestController);
      return {
        accepted: [],
        conflicts: [],
        rejected: [],
      };
    }

    this.currentActiveUserId = credentials.userId;
    try {
      await this.loadStateForCredentials(credentials);
      effectiveSignal.throwIfAborted();

      const accessToken = await (this.authService as any).getValidAccessToken(false, credentials.userId);
      effectiveSignal.throwIfAborted();

      const hlc = this.getHlc(credentials.deviceId);
      const currentHlc = hlc.now();
      this.pushSequence += 1;

      const mutationsToUpload = request.mutations.map((mutation) => {
        const payload = mutation.payload as Record<string, unknown> | undefined;
        if (
          payload &&
          typeof payload.originShareId === 'string' &&
          (mutation.entityType === ('material' as any) || mutation.entityType === 'pointer')
        ) {
          return {
            ...mutation,
            entityType: 'pointer' as const,
            entityId: payload.originShareId,
            operation: 'UPSERT' as const,
            payload: {
              originShareId: payload.originShareId,
              title: typeof payload.title === 'string' ? payload.title : '',
              publishedAt: typeof payload.createdAt === 'string' ? payload.createdAt : mutation.clientTimestamp,
              schemaVersion: typeof payload.schemaVersion === 'number' ? payload.schemaVersion : 1,
            } satisfies SyncPointerPayload,
          };
        }
        return mutation;
      });

      const fileName = `journal_${currentHlc}.json.gz`;
      const journalPayload: JournalPayload = {
        hlc: currentHlc,
        deviceId: credentials.deviceId,
        createdAt: new Date().toISOString(),
        mutations: mutationsToUpload,
      };

      const appProperties: Record<string, string> = {
        type: 'journal',
        deviceId: credentials.deviceId,
        hlc: currentHlc,
        seq: String(this.pushSequence),
        count: String(mutationsToUpload.length),
      };

      let uploadedFile: DriveFileMetadata;
      if (typeof this.driveClient.uploadCompressedJson === 'function') {
        uploadedFile = await this.driveClient.uploadCompressedJson(
          fileName,
          journalPayload,
          appProperties,
          accessToken,
          ['appDataFolder'],
          { signal: effectiveSignal }
        );
      } else {
        uploadedFile = await this.driveClient.uploadFile({
          name: fileName,
          content: JSON.stringify(journalPayload),
          compress: true,
          parents: ['appDataFolder'],
          appProperties,
          accessToken,
          signal: effectiveSignal,
        });
      }

      effectiveSignal.throwIfAborted();
      if (this.disposed || this.abortController.signal.aborted) {
        throw new Error('GoogleDriveSyncTransport is disposed');
      }

      // Mark our uploaded file as applied to avoid re-ingesting our own journal on pull
      if (uploadedFile?.id) {
        this.markFileApplied(uploadedFile.id);
        const uploadedId = uploadedFile.id;
        const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
        await this.updateRepoSyncState(tokenKey, (existing) => {
          const mergedApplied = new Set<string>(existing?.appliedFileIds ?? []);
          mergedApplied.add(uploadedId);
          const appliedList = Array.from(mergedApplied).slice(-MAX_PERSISTED_APPLIED_FILES);
          return {
            ...(existing ?? {
              key: tokenKey,
              userId: credentials.userId,
              deviceId: credentials.deviceId,
              lastServerCursor: 0,
            }),
            appliedFileIds: appliedList,
          };
        });
      }

      const accepted = request.mutations.map((mutation) => ({
        clientMutationId: mutation.clientMutationId,
        entityType: mutation.entityType,
        entityId: mutation.entityId,
        newVersion: (mutation.baseVersion ?? 0) + 1,
      }));

      return {
        accepted,
        conflicts: [],
        rejected: [],
      };
    } finally {
      this.activeControllers.delete(requestController);
      this.currentActiveUserId = undefined;
    }
  }

  /**
   * Pulls remote changes from Google Drive appDataFolder by polling the changes feed,
   * downloading newly added journal files, and mapping their mutations to SyncChangeItems.
   */
  async pull(
    credentials: SessionCredentials,
    cursor: SyncCursor,
    limit: number = 100,
    signal?: AbortSignal
  ): Promise<SyncPullResponse> {
    if (this.disposed || this.abortController.signal.aborted) {
      throw new Error('GoogleDriveSyncTransport is disposed');
    }
    if (this.expectedSub && credentials.userId !== this.expectedSub) {
      throw new DriveAuthError(
        `Account mismatch: expected ${this.expectedSub} but received ${credentials.userId}`
      );
    }

    const requestController = new AbortController();
    this.activeControllers.add(requestController);
    const effectiveSignal = this.getCombinedSignal(signal, requestController.signal);
    effectiveSignal.throwIfAborted();

    this.currentActiveUserId = credentials.userId;
    try {
      await this.loadStateForCredentials(credentials);
      effectiveSignal.throwIfAborted();

      const accessToken = await (this.authService as any).getValidAccessToken(false, credentials.userId);
      effectiveSignal.throwIfAborted();

      const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
      let pageToken = this.pageTokens.get(tokenKey);

      // If we don't have an active pendingBatch for this tokenKey, discover candidates
      if (!this.pendingBatch || this.pendingBatch.tokenKey !== tokenKey) {
        let changesResponse: DriveChangesResponse;
        let recoveredMissingFiles: DriveFileMetadata[] = [];
        let pendingTokenToCommit: string | undefined;

        if (!pageToken) {
          // Cursor-First Hydration Invariant:
          // 1. Call candidateToken = await this.driveClient.getStartPageToken(accessToken) FIRST at t0.
          const candidateToken = await this.driveClient.getStartPageToken(accessToken, { signal: effectiveSignal });
          pendingTokenToCommit = candidateToken;

          // 2. Call allFiles = await this.driveClient.listFiles(accessToken) at t1.
          const allFiles = await this.driveClient.listFiles(accessToken, undefined, { signal: effectiveSignal });
          effectiveSignal.throwIfAborted();

          // Baseline Seeding: Cold remote check when not yet driveSeeded
          if (!this.driveSeeded) {
            const syncFiles = allFiles.filter(
              (file) => !file.trashed && this.isSyncFile(file)
            );
            if (syncFiles.length === 0) {
              // Cold Remote: seed Dexie vault as baseline snapshot
              await this.seedColdRemote(credentials, accessToken, effectiveSignal);
            }
          }

          // 3. Discover all existing unapplied sync files in appDataFolder to hydrate past journals/snapshots.
          for (const file of allFiles) {
            if (this.isSyncFile(file)) {
              if (
                this.appliedFileIds.has(file.id) ||
                this.pendingBatch?.completedCandidateFileIds.has(file.id) ||
                (this.pendingDiscoveryState?.completedFileIds.includes(file.id) ?? false)
              ) {
                continue;
              }
              recoveredMissingFiles.push(file);
            }
          }

          changesResponse = {
            changes: [],
            newStartPageToken: candidateToken,
          };
          // NOTE: candidateToken is NOT committed to this.pageTokens yet!
          // Only after downloading and applying hydrated candidate journals is candidateToken committed.
        } else {
          try {
            changesResponse = await this.driveClient.listChanges(pageToken, accessToken, { signal: effectiveSignal });
            pendingTokenToCommit = changesResponse.nextPageToken ?? changesResponse.newStartPageToken;
          } catch (err) {
            if (this.is410Error(err)) {
              const recoveryParams: Recover410Params = {
                accessToken,
                appliedFileIds: this.appliedFileIds,
                peerWatermarks: this.peerWatermarks,
                pendingFileId: this.pendingFileProgress?.fileId,
                signal: effectiveSignal,
              };

              const recoveryResult: CursorRecoveryResult =
                typeof this.driveClient.recoverFromInvalidPageToken === 'function'
                  ? await this.driveClient.recoverFromInvalidPageToken(recoveryParams)
                  : await this.driveClient.recover410Cursor(recoveryParams);

              pendingTokenToCommit = recoveryResult.newPageToken;
              changesResponse = {
                changes: [],
                newStartPageToken: recoveryResult.newPageToken,
              };
              recoveredMissingFiles = recoveryResult.missingFiles;
            } else {
              throw err;
            }
          }
        }

        effectiveSignal.throwIfAborted();

        const candidateList: PendingBatchCandidate[] = [];
        const seenCandidateFileIds = new Set<string>();

        for (const change of changesResponse.changes) {
          if (change.removed || !change.file) {
            continue;
          }
          if (
            this.isJournalFile(change.file) &&
            !this.appliedFileIds.has(change.file.id) &&
            !this.pendingBatch?.completedCandidateFileIds.has(change.file.id) &&
            !(this.pendingDiscoveryState?.completedFileIds.includes(change.file.id) ?? false) &&
            !seenCandidateFileIds.has(change.file.id)
          ) {
            seenCandidateFileIds.add(change.file.id);
            candidateList.push({ fileId: change.file.id, metadata: change.file });
          }
        }

        for (const file of recoveredMissingFiles) {
          if (
            this.isSyncFile(file) &&
            !this.appliedFileIds.has(file.id) &&
            !this.pendingBatch?.completedCandidateFileIds.has(file.id) &&
            !(this.pendingDiscoveryState?.completedFileIds.includes(file.id) ?? false) &&
            !seenCandidateFileIds.has(file.id)
          ) {
            seenCandidateFileIds.add(file.id);
            candidateList.push({ fileId: file.id, metadata: file });
          }
        }

        if (this.pendingFileProgress && !seenCandidateFileIds.has(this.pendingFileProgress.fileId)) {
          const pendingFileId = this.pendingFileProgress.fileId;
          const files = await this.driveClient.listFiles(accessToken, undefined, { signal: effectiveSignal });
          const pendingFile = files.find((f) => f.id === pendingFileId);
          if (
            pendingFile &&
            !this.appliedFileIds.has(pendingFile.id) &&
            !this.pendingBatch?.completedCandidateFileIds.has(pendingFile.id) &&
            !(this.pendingDiscoveryState?.completedFileIds.includes(pendingFile.id) ?? false)
          ) {
            seenCandidateFileIds.add(pendingFile.id);
            candidateList.push({ fileId: pendingFile.id, metadata: pendingFile });
          }
        }

        // Sort candidates deterministically by HLC timestamp with tie-breakers
        candidateList.sort((a, b) => {
          const hlca = this.extractHlc(a.metadata);
          const hlcb = this.extractHlc(b.metadata);
          const cmp = compareHlc(hlca, hlcb);
          if (cmp !== 0) return cmp;
          const isSnapA = this.isSnapshotFile(a.metadata) ? 0 : 1;
          const isSnapB = this.isSnapshotFile(b.metadata) ? 0 : 1;
          if (isSnapA !== isSnapB) return isSnapA - isSnapB;
          return a.fileId.localeCompare(b.fileId);
        });

        const completedSet = new Set<string>(this.pendingDiscoveryState?.completedFileIds ?? []);

        this.pendingBatch = {
          tokenKey,
          pendingTokenToCommit: this.pendingDiscoveryState?.pendingTokenToCommit ?? pendingTokenToCommit,
          changesResponseHasMorePages: this.pendingDiscoveryState?.hasMorePages ?? Boolean(changesResponse.nextPageToken),
          candidates: candidateList,
          completedCandidateFileIds: completedSet,
          allCandidateFileIds: this.pendingDiscoveryState?.candidateFileIds ?? candidateList.map((c) => c.fileId),
        };
      }

      effectiveSignal.throwIfAborted();

      const changes: SyncChangeItem[] = [];
      const localHlc = this.getHlc(credentials.deviceId);
      const batchAppliedFileIds: string[] = [];
      let batchPendingProgress: PullFileProgress | undefined = undefined;
      const batchPeerWatermarks: Record<string, string> = {};
      const batchLimit = typeof limit === 'number' && limit > 0 ? limit : 100;

      for (const candidate of this.pendingBatch.candidates) {
        effectiveSignal.throwIfAborted();

        if (changes.length >= batchLimit) {
          break;
        }

        // If file already applied in an earlier acknowledged batch or completed in this pending batch, skip
        if (
          this.pendingBatch.completedCandidateFileIds.has(candidate.fileId) ||
          this.appliedFileIds.has(candidate.fileId) ||
          batchAppliedFileIds.includes(candidate.fileId)
        ) {
          continue;
        }

        if (!candidate.journal) {
          try {
            if (typeof this.driveClient.downloadCompressedJson === 'function') {
              candidate.journal = await this.driveClient.downloadCompressedJson<JournalPayload>(
                candidate.fileId,
                accessToken,
                { signal: effectiveSignal }
              );
            } else {
              const text = await this.driveClient.downloadFile(candidate.fileId, accessToken, {
                decompress: true,
                signal: effectiveSignal,
              });
              candidate.journal = JSON.parse(text) as JournalPayload;
            }
          } catch (err) {
            if (this.isCorruptedFileError(err)) {
              // Prevent repeated failures on corrupted file
              batchAppliedFileIds.push(candidate.fileId);
              continue;
            }
            throw err;
          }
        }

        effectiveSignal.throwIfAborted();
        if (this.disposed || this.abortController.signal.aborted) {
          throw new Error('GoogleDriveSyncTransport is disposed');
        }

        const journal: JournalPayload = candidate.journal!;
        const mutations = Array.isArray(journal.mutations) ? journal.mutations : [];
        const totalMutations = mutations.length;

        // Check offset: if this candidate matches this.pendingFileProgress, start from offset
        let startOffset = 0;
        if (this.pendingFileProgress && this.pendingFileProgress.fileId === candidate.fileId) {
          startOffset = this.pendingFileProgress.offset;
        }

        const remainingInFile = Math.max(0, totalMutations - startOffset);
        const remainingLimit = batchLimit - changes.length;

        if (remainingInFile === 0) {
          // File has no unconsumed mutations (e.g. empty journal) -> mark completed
          batchAppliedFileIds.push(candidate.fileId);

          const fileHlc = candidate.metadata.appProperties?.hlc ?? journal.hlc;
          const fileDeviceId = candidate.metadata.appProperties?.deviceId ?? journal.deviceId;
          if (fileHlc) {
            localHlc.receive(fileHlc);
          }
          if (fileDeviceId && fileHlc) {
            batchPeerWatermarks[fileDeviceId] = fileHlc;
          }
          continue;
        }

        if (remainingLimit <= 0) {
          // Batch limit already reached by prior files; leave this file for next pull
          break;
        }

        const takeCount = Math.min(remainingInFile, remainingLimit);
        const endOffset = startOffset + takeCount;
        const slice = mutations.slice(startOffset, endOffset);

        for (const mutation of slice) {
          if (mutation.entityType === 'pointer' && mutation.payload) {
            const pointerPayload = mutation.payload as SyncPointerPayload;
            if (pointerPayload.originShareId) {
              await this.enqueuePointerOperation(pointerPayload);
            }
          }
          this.currentSequence = cursor + changes.length + 1;
          changes.push({
            sequence: this.currentSequence,
            entityType: mutation.entityType,
            entityId: mutation.entityId,
            operation: mutation.operation,
            version: mutation.baseVersion,
            changedAt: mutation.clientTimestamp,
            data: mutation.payload,
          });
        }

        const fileHlc = candidate.metadata.appProperties?.hlc ?? journal.hlc;
        const fileDeviceId = candidate.metadata.appProperties?.deviceId ?? journal.deviceId;
        if (fileHlc) {
          localHlc.receive(fileHlc);
        }

        if (endOffset === totalMutations) {
          // Fully consumed this file
          batchAppliedFileIds.push(candidate.fileId);
          if (fileDeviceId && fileHlc) {
            if (!batchPeerWatermarks[fileDeviceId] || compareHlc(fileHlc, batchPeerWatermarks[fileDeviceId]) > 0) {
              batchPeerWatermarks[fileDeviceId] = fileHlc;
            }
          }
        } else {
          // Partially consumed this file
          batchPendingProgress = {
            fileId: candidate.fileId,
            offset: endOffset,
            totalMutations,
          };
          // Reached limit
          break;
        }
      }

      // Check if all candidates in pendingBatch are completed
      const allCompletedCandidateIds = new Set<string>([
        ...this.pendingBatch.completedCandidateFileIds,
        ...batchAppliedFileIds,
      ]);

      const allCandidatesCompleted = this.pendingBatch.candidates.every(
        (c) =>
          allCompletedCandidateIds.has(c.fileId) ||
          this.appliedFileIds.has(c.fileId)
      ) && !batchPendingProgress;

      let pageTokenToCommit: string | undefined;
      let hasMore: boolean;
      let pendingDiscoveryToEmit: PendingDiscoveryState | undefined;

      if (allCandidatesCompleted) {
        pageTokenToCommit = this.pendingBatch.pendingTokenToCommit;
        hasMore = this.pendingBatch.changesResponseHasMorePages;
        pendingDiscoveryToEmit = undefined;
      } else {
        pageTokenToCommit = undefined;
        hasMore = true;
        pendingDiscoveryToEmit = {
          candidateFileIds: this.pendingBatch.allCandidateFileIds ?? this.pendingBatch.candidates.map((c) => c.fileId),
          completedFileIds: Array.from(allCompletedCandidateIds),
          pendingTokenToCommit: this.pendingBatch.pendingTokenToCommit,
          hasMorePages: this.pendingBatch.changesResponseHasMorePages,
        };
      }

      // Baseline Seeding: Warm remote check when not yet driveSeeded
      if (!this.driveSeeded) {
        await this.seedWarmRemoteDeltas(credentials, changes, accessToken, effectiveSignal);
        this.driveSeeded = true;
      }

      const receipt: PullReceipt = {
        receiptId: crypto.randomUUID(),
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        baseCursor: cursor,
        baseRevision: this.currentCheckpointRevision ?? 0,
        appliedFileIds: batchAppliedFileIds,
        pendingFileProgress: batchPendingProgress,
        pendingDiscovery: pendingDiscoveryToEmit,
        pageToken: pageTokenToCommit,
        peerWatermarks: Object.keys(batchPeerWatermarks).length > 0 ? batchPeerWatermarks : undefined,
      };

      const newCursor = cursor + changes.length;

      return {
        newCursor,
        hasMore,
        changes,
        receipt,
      };
    } finally {
      this.activeControllers.delete(requestController);
    }
  }

  /**
   * Explicitly acknowledges a reconciled pull batch, durably updating in-memory state
   * and committing the checkpoint to SyncStateRepository.
   */
  async acknowledgePull(
    credentials: SessionCredentials,
    receipt?: PullReceipt,
    signal?: AbortSignal
  ): Promise<void> {
    if (this.disposed || this.abortController.signal.aborted || signal?.aborted) {
      throw signal?.reason ?? this.abortController.signal.reason ?? new Error('GoogleDriveSyncTransport is disposed');
    }
    if (this.expectedSub && credentials.userId !== this.expectedSub) {
      throw new DriveAuthError(
        `Account mismatch: expected ${this.expectedSub} but received ${credentials.userId}`
      );
    }
    if (this.currentActiveUserId && credentials.userId !== this.currentActiveUserId) {
      throw new DriveAuthError(
        `Account mismatch: active user ${this.currentActiveUserId} but received ${credentials.userId}`
      );
    }
    if (!receipt) {
      return;
    }
    if (receipt.userId !== credentials.userId) {
      throw new DriveAuthError(
        `Receipt user mismatch: receipt ${receipt.userId} but credentials ${credentials.userId}`
      );
    }
    if (receipt.deviceId !== credentials.deviceId) {
      throw new DriveAuthError(
        `Receipt device mismatch: receipt ${receipt.deviceId} but credentials ${credentials.deviceId}`
      );
    }

    const tokenKey = `${credentials.userId}:${credentials.deviceId}`;

    // Read durable committed state first
    const durableState = await this.stateRepo.getSyncState(tokenKey);

    // Re-check signal, disposed, and credentials after await
    if (this.disposed || this.abortController.signal.aborted || signal?.aborted) {
      throw signal?.reason ?? this.abortController.signal.reason ?? new Error('GoogleDriveSyncTransport is disposed');
    }
    if (this.expectedSub && credentials.userId !== this.expectedSub) {
      throw new DriveAuthError(
        `Account mismatch: expected ${this.expectedSub} but received ${credentials.userId}`
      );
    }
    if (this.currentActiveUserId && credentials.userId !== this.currentActiveUserId) {
      throw new DriveAuthError(
        `Account mismatch: active user ${this.currentActiveUserId} but received ${credentials.userId}`
      );
    }

    // Verify durableState: if durableState is missing or if receipt.baseRevision !== undefined and durableState.checkpointRevision <= receipt.baseRevision
    // The receipt was NEVER committed in Dexie! Do not adopt uncommitted receipt into RAM!
    if (
      !durableState ||
      typeof durableState.checkpointRevision !== 'number' ||
      (receipt.baseRevision !== undefined &&
        durableState.checkpointRevision <= receipt.baseRevision)
    ) {
      return;
    }

    // Adopt authoritative state strictly from durableState
    this.currentCheckpointRevision = durableState.checkpointRevision;

    if (durableState.pageToken) {
      this.pageTokens.set(tokenKey, durableState.pageToken);
    }

    if (Array.isArray(durableState.appliedFileIds)) {
      for (const fileId of durableState.appliedFileIds) {
        if (typeof fileId === 'string') {
          this.markFileApplied(fileId);
        }
      }
    }

    this.pendingFileProgress = durableState.pendingFileProgress
      ? { ...durableState.pendingFileProgress }
      : undefined;

    if (this.pendingBatch) {
      if (Array.isArray(durableState.pendingDiscovery?.completedFileIds)) {
        for (const fileId of durableState.pendingDiscovery.completedFileIds) {
          this.pendingBatch.completedCandidateFileIds.add(fileId);
        }
      }
      if (Array.isArray(durableState.appliedFileIds)) {
        for (const fileId of durableState.appliedFileIds) {
          if (this.pendingBatch.candidates.some((c) => c.fileId === fileId)) {
            this.pendingBatch.completedCandidateFileIds.add(fileId);
          }
        }
      }

      const allDone =
        this.pendingBatch.candidates.every(
          (c) =>
            this.pendingBatch!.completedCandidateFileIds.has(c.fileId) ||
            this.appliedFileIds.has(c.fileId)
        ) && !this.pendingFileProgress;
      if (allDone) {
        this.pendingBatch = undefined;
        this.pendingDiscoveryState = undefined;
      }
    }

    if (durableState.peerWatermarks && typeof durableState.peerWatermarks === 'object') {
      for (const [deviceId, hlc] of Object.entries(durableState.peerWatermarks)) {
        if (typeof hlc === 'string') {
          const current = this.peerWatermarks[deviceId];
          if (!current || compareHlc(hlc, current) > 0) {
            this.peerWatermarks[deviceId] = hlc;
          }
        }
      }
    }

    if (typeof durableState.driveSeeded === 'boolean') {
      this.driveSeeded = durableState.driveSeeded;
    }
  }

  /**
   * Returns in-memory pending file progress (for testing/inspection).
   */
  getPendingFileProgress(): Readonly<PullFileProgress> | undefined {
    return this.pendingFileProgress ? { ...this.pendingFileProgress } : undefined;
  }

  /**
   * Returns read-only set of applied file IDs (for testing/inspection).
   */
  getAppliedFileIds(): ReadonlySet<string> {
    return this.appliedFileIds;
  }

  /**
   * Returns read-only peer watermarks map (for testing/inspection).
   */
  getPeerWatermarks(): Readonly<Record<string, string>> {
    return this.peerWatermarks;
  }

  /**
   * Returns cached pageToken for a user/device pairing if present.
   */
  getPageToken(userId: string, deviceId: string): string | undefined {
    return this.pageTokens.get(`${userId}:${deviceId}`);
  }

  /**
   * Sets cached pageToken for a user/device pairing (for testing/hydration).
   */
  setPageToken(userId: string, deviceId: string, pageToken: string): void {
    this.pageTokens.set(`${userId}:${deviceId}`, pageToken);
    void this.saveStateForCredentials({ userId, deviceId, token: '' });
  }

  /**
   * Clears in-memory and persisted transport state (for testing / logout).
   */
  clearState(credentials?: SessionCredentials): void {
    this.currentActiveUserId = undefined;
    this.pageTokens.clear();
    this.appliedFileIds.clear();
    this.pendingFileProgress = undefined;
    this.pendingBatch = undefined;
    this.driveSeeded = false;
    this.currentCheckpointRevision = 0;
    for (const key of Object.keys(this.peerWatermarks)) {
      delete this.peerWatermarks[key];
    }
    void this.clearStateAsync(credentials);
  }

  isDriveSeeded(): boolean {
    return this.driveSeeded;
  }

  setDriveSeeded(seeded: boolean): void {
    this.driveSeeded = seeded;
  }

  async clearStateAsync(credentials?: SessionCredentials): Promise<void> {
    this.currentActiveUserId = undefined;
    this.pageTokens.clear();
    this.appliedFileIds.clear();
    this.pendingFileProgress = undefined;
    this.pendingBatch = undefined;
    this.driveSeeded = false;
    this.currentCheckpointRevision = 0;
    for (const key of Object.keys(this.peerWatermarks)) {
      delete this.peerWatermarks[key];
    }
    if (credentials) {
      const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
      try {
        const existing = await this.stateRepo.getSyncState(tokenKey);
        if (existing) {
          const clearedState: SyncState = {
            ...existing,
            pageToken: undefined,
            appliedFileIds: [],
            pendingFileProgress: undefined,
            peerWatermarks: {},
            driveSeeded: false,
          };
          delete (clearedState as any).pendingFileProgress;
          await this.stateRepo.saveSyncState(clearedState);
        }
      } catch {
        // Non-fatal
      }
    }
  }

  private async loadStateForCredentials(credentials: SessionCredentials): Promise<void> {
    const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
    if (this.pendingBatch && this.pendingBatch.tokenKey !== tokenKey) {
      this.pendingBatch = undefined;
    }
    try {
      const stored = await this.stateRepo.getSyncState(tokenKey);
      if (stored) {
        this.currentCheckpointRevision = stored.checkpointRevision ?? 0;
        if (typeof stored.driveSeeded === 'boolean') {
          this.driveSeeded = stored.driveSeeded;
        }
        if (stored.pageToken) {
          this.pageTokens.set(tokenKey, stored.pageToken);
        }
        if (Array.isArray(stored.appliedFileIds)) {
          for (const id of stored.appliedFileIds) {
            if (typeof id === 'string') {
              this.markFileApplied(id);
            }
          }
        }
        if (stored.pendingFileProgress) {
          this.pendingFileProgress = { ...stored.pendingFileProgress };
        } else {
          this.pendingFileProgress = undefined;
        }
        if (stored.pendingDiscovery) {
          this.pendingDiscoveryState = { ...stored.pendingDiscovery };
        } else {
          this.pendingDiscoveryState = undefined;
        }
        if (stored.peerWatermarks && typeof stored.peerWatermarks === 'object') {
          for (const [deviceId, hlc] of Object.entries(stored.peerWatermarks)) {
            if (typeof hlc === 'string') {
              const current = this.peerWatermarks[deviceId];
              if (!current || compareHlc(hlc, current) > 0) {
                this.peerWatermarks[deviceId] = hlc;
              }
            }
          }
        }
      }
    } catch {
      // Non-fatal if state repository read fails
    }
  }

  private async updateRepoSyncState(
    tokenKey: string,
    updater: (current: SyncState | null) => SyncState
  ): Promise<void> {
    try {
      if (typeof this.stateRepo.updateSyncState === 'function') {
        await this.stateRepo.updateSyncState(tokenKey, updater);
      } else {
        const existing = await this.stateRepo.getSyncState(tokenKey);
        const updated = updater(existing);
        await this.stateRepo.saveSyncState(updated);
      }
    } catch {
      // Storage quota or IndexedDB transaction errors must not crash sync
    }
  }

  private async saveStateForCredentials(credentials: SessionCredentials): Promise<void> {
    const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
    await this.updateRepoSyncState(tokenKey, (existing) => {
      const mergedAppliedIds = new Set<string>();
      if (Array.isArray(existing?.appliedFileIds)) {
        for (const id of existing.appliedFileIds) {
          mergedAppliedIds.add(id);
        }
      }
      for (const id of this.appliedFileIds) {
        mergedAppliedIds.add(id);
      }
      const appliedList = Array.from(mergedAppliedIds).slice(-MAX_PERSISTED_APPLIED_FILES);

      const mergedWatermarks: Record<string, string> = {
        ...(existing?.peerWatermarks ?? {}),
      };
      for (const [deviceId, hlc] of Object.entries(this.peerWatermarks)) {
        const current = mergedWatermarks[deviceId];
        if (!current || compareHlc(hlc, current) > 0) {
          mergedWatermarks[deviceId] = hlc;
        }
      }

      // DO NOT overwrite existing.pageToken with stale cached pageToken!
      const resolvedPageToken = existing?.pageToken ?? this.pageTokens.get(tokenKey);

      // DO NOT overwrite existing.pendingFileProgress with undefined if in-memory is undefined!
      let pendingProgress: PullFileProgress | undefined;
      if (existing?.pendingFileProgress && !mergedAppliedIds.has(existing.pendingFileProgress.fileId)) {
        pendingProgress = existing.pendingFileProgress;
      } else if (this.pendingFileProgress) {
        pendingProgress = this.pendingFileProgress;
      }

      const state: SyncState = {
        key: tokenKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: existing?.lastServerCursor ?? 0,
        checkpointRevision: existing?.checkpointRevision ?? this.currentCheckpointRevision ?? 0,
        lastSyncedAt: existing?.lastSyncedAt,
        pageToken: resolvedPageToken,
        appliedFileIds: appliedList,
        pendingFileProgress: pendingProgress,
        pendingDiscovery: existing?.pendingDiscovery,
        peerWatermarks: mergedWatermarks,
        driveSeeded: this.driveSeeded || Boolean(existing?.driveSeeded),
      };
      if (!state.pendingFileProgress) {
        delete (state as any).pendingFileProgress;
      }
      if (!state.pendingDiscovery) {
        delete (state as any).pendingDiscovery;
      }
      return state;
    });
  }

  private markFileApplied(fileId: string): void {
    if (this.appliedFileIds.has(fileId)) {
      this.appliedFileIds.delete(fileId);
    }
    this.appliedFileIds.add(fileId);
    if (this.appliedFileIds.size > MAX_PERSISTED_APPLIED_FILES) {
      const oldest = this.appliedFileIds.keys().next().value;
      if (oldest !== undefined) {
        this.appliedFileIds.delete(oldest);
      }
    }
  }

  private extractHlc(metadata: DriveFileMetadata): string {
    if (metadata.appProperties?.hlc) {
      return metadata.appProperties.hlc;
    }
    const match = /^(?:journal|snapshot)_(.+)\.json\.gz$/.exec(metadata.name ?? '');
    if (match?.[1]) {
      return match[1];
    }
    return metadata.name ?? '';
  }

  private getHlc(deviceId: string): HybridLogicalClock {
    let hlc = this.hlcs.get(deviceId) ?? this.hlcs.get('default');
    if (!hlc) {
      hlc = createHlc(deviceId);
      this.hlcs.set(deviceId, hlc);
    }
    return hlc;
  }

  private isCorruptedFileError(err: unknown): boolean {
    if (err instanceof SyntaxError) {
      return true;
    }
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      if (
        msg.includes('unexpected token') ||
        msg.includes('bad gzip') ||
        msg.includes('corrupted') ||
        msg.includes('invalid json') ||
        msg.includes('decompression')
      ) {
        return true;
      }
    }
    return false;
  }

  private is410Error(err: unknown): boolean {
    if (err instanceof DriveHttpError) {
      return err.status === 410;
    }
    if (typeof err === 'object' && err !== null) {
      const status = (err as { status?: number }).status;
      if (status === 410) {
        return true;
      }
      const message = (err as { message?: string }).message ?? '';
      if (
        message.includes('410') ||
        message.includes('invalid page token') ||
        message.includes('startPageToken')
      ) {
        return true;
      }
    }
    return false;
  }

  isJournalFile(file: DriveFileMetadata): boolean {
    if (file.trashed) {
      return false;
    }
    if (file.appProperties?.type === 'journal') {
      return true;
    }
    if (file.name && file.name.startsWith('journal_') && file.name.endsWith('.json.gz')) {
      return true;
    }
    return false;
  }

  isSnapshotFile(file: DriveFileMetadata): boolean {
    if (file.trashed) {
      return false;
    }
    if (file.appProperties?.type === 'snapshot') {
      return true;
    }
    if (file.name && file.name.startsWith('snapshot_') && file.name.endsWith('.json.gz')) {
      return true;
    }
    return false;
  }

  isSyncFile(file: DriveFileMetadata): boolean {
    return this.isJournalFile(file) || this.isSnapshotFile(file);
  }

  private async seedColdRemote(
    credentials: SessionCredentials,
    accessToken: string,
    signal?: AbortSignal
  ): Promise<void> {
    const chunks = await collectVaultChunksGzipped(this.db, credentials.deviceId);
    signal?.throwIfAborted();

    const isMultiPart = chunks.length > 1;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      signal?.throwIfAborted();
      const fileName = `snapshot_${chunk.hlc}_${credentials.deviceId}.json.gz`;
      const appProperties: Record<string, string> = {
        type: 'snapshot',
        deviceId: credentials.deviceId,
        hlc: chunk.hlc,
        count: String(chunk.mutations.length),
        ...(isMultiPart
          ? {
              isSeedPart: 'true',
              partIndex: String(i),
              totalParts: String(chunks.length),
            }
          : {}),
      };

      const snapshotPayload = {
        version: 1,
        hlc: chunk.hlc,
        deviceId: credentials.deviceId,
        createdAt: chunk.createdAt,
        coveredJournalFileIds: [],
        watermarks: { [credentials.deviceId]: chunk.hlc },
        mutations: chunk.mutations,
        ...(isMultiPart
          ? {
              isSeedPart: true,
              partIndex: i,
              totalParts: chunks.length,
            }
          : {}),
      };

      let uploadedFile: DriveFileMetadata;
      if (typeof this.driveClient.uploadCompressedJson === 'function') {
        uploadedFile = await this.driveClient.uploadCompressedJson(
          fileName,
          snapshotPayload,
          appProperties,
          accessToken,
          ['appDataFolder'],
          { signal }
        );
      } else {
        uploadedFile = await this.driveClient.uploadFile({
          name: fileName,
          content: chunk.compressedGzip,
          compress: false,
          mimeType: 'application/gzip',
          parents: ['appDataFolder'],
          appProperties,
          accessToken,
          signal,
        });
      }

      signal?.throwIfAborted();
      if (this.disposed || this.abortController.signal.aborted) {
        throw new Error('GoogleDriveSyncTransport is disposed');
      }

      if (uploadedFile?.id) {
        this.markFileApplied(uploadedFile.id);
      }
    }

    this.driveSeeded = true;
    const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
    await this.updateRepoSyncState(tokenKey, (existing) => {
      const mergedApplied = new Set<string>(existing?.appliedFileIds ?? []);
      for (const id of this.appliedFileIds) {
        mergedApplied.add(id);
      }
      return {
        ...(existing ?? {
          key: tokenKey,
          userId: credentials.userId,
          deviceId: credentials.deviceId,
          lastServerCursor: 0,
          checkpointRevision: this.currentCheckpointRevision ?? 0,
        }),
        driveSeeded: true,
        appliedFileIds: Array.from(mergedApplied).slice(-MAX_PERSISTED_APPLIED_FILES),
      };
    });
  }

  private async seedWarmRemoteDeltas(
    credentials: SessionCredentials,
    remoteChanges: SyncChangeItem[],
    accessToken: string,
    signal?: AbortSignal
  ): Promise<void> {
    signal?.throwIfAborted();
    const remoteEntityHlcById = new Map<string, string>();
    for (const ch of remoteChanges) {
      if (ch.entityId && ch.changedAt) {
        const current = remoteEntityHlcById.get(ch.entityId);
        if (!current || compareHlc(ch.changedAt, current) > 0) {
          remoteEntityHlcById.set(ch.entityId, ch.changedAt);
        }
      }
    }

    const localDeltas: SyncMutation[] = [];
    await this.collectLocalDeltas(remoteEntityHlcById, localDeltas, credentials.deviceId);
    signal?.throwIfAborted();

    if (localDeltas.length > 0) {
      const hlc = this.getHlc(credentials.deviceId);
      const currentHlc = hlc.now();
      this.pushSequence += 1;

      const fileName = `journal_${currentHlc}.json.gz`;
      const journalPayload: JournalPayload = {
        hlc: currentHlc,
        deviceId: credentials.deviceId,
        createdAt: new Date().toISOString(),
        mutations: localDeltas,
      };

      const appProperties: Record<string, string> = {
        type: 'journal',
        deviceId: credentials.deviceId,
        hlc: currentHlc,
        seq: String(this.pushSequence),
        count: String(localDeltas.length),
      };

      let uploadedFile: DriveFileMetadata;
      if (typeof this.driveClient.uploadCompressedJson === 'function') {
        uploadedFile = await this.driveClient.uploadCompressedJson(
          fileName,
          journalPayload,
          appProperties,
          accessToken,
          ['appDataFolder'],
          { signal }
        );
      } else {
        uploadedFile = await this.driveClient.uploadFile({
          name: fileName,
          content: JSON.stringify(journalPayload),
          compress: true,
          parents: ['appDataFolder'],
          appProperties,
          accessToken,
          signal,
        });
      }

      signal?.throwIfAborted();
      if (this.disposed || this.abortController.signal.aborted) {
        throw new Error('GoogleDriveSyncTransport is disposed');
      }

      if (uploadedFile?.id) {
        this.markFileApplied(uploadedFile.id);
      }
    }

    this.driveSeeded = true;
    const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
    await this.updateRepoSyncState(tokenKey, (existing) => {
      const mergedApplied = new Set<string>(existing?.appliedFileIds ?? []);
      for (const id of this.appliedFileIds) {
        mergedApplied.add(id);
      }
      return {
        ...(existing ?? {
          key: tokenKey,
          userId: credentials.userId,
          deviceId: credentials.deviceId,
          lastServerCursor: 0,
          checkpointRevision: this.currentCheckpointRevision ?? 0,
        }),
        driveSeeded: true,
        appliedFileIds: Array.from(mergedApplied).slice(-MAX_PERSISTED_APPLIED_FILES),
      };
    });
  }

  private async collectLocalDeltas(
    remoteEntityHlcById: Map<string, string>,
    deltas: SyncMutation[],
    deviceId: string
  ): Promise<void> {
    // 0. Cloned Explore materials -> emit pointer operation instead of raw entity deltas
    for await (const mat of paginateTable(this.db.materials, 100)) {
      if (mat.originShareId) {
        const localHlc = deriveEntityHlc(mat.updatedAt ?? mat.createdAt, deviceId);
        const remoteHlc = remoteEntityHlcById.get(mat.originShareId);
        if (!remoteHlc || compareHlc(localHlc, remoteHlc) > 0) {
          deltas.push({
            clientMutationId: `baseline-delta-pointer-${mat.originShareId}`,
            entityType: 'pointer',
            entityId: mat.originShareId,
            operation: 'UPSERT',
            clientTimestamp: localHlc,
            payload: {
              originShareId: mat.originShareId,
              title: mat.title,
              publishedAt: mat.createdAt,
              schemaVersion: 1,
            } satisfies SyncPointerPayload,
          });
        }
      }
    }

    // 1. Documents
    for await (const doc of paginateTable(this.db.documentContents, 100)) {
      if (doc.updatedAt === FLOOR_ISO && !doc.deletedAt) {
        continue;
      }
      const localHlc = deriveEntityHlc(doc.updatedAt, deviceId);
      const remoteHlc = remoteEntityHlcById.get(doc.documentId);
      if (!remoteHlc || compareHlc(localHlc, remoteHlc) > 0) {
        deltas.push({
          clientMutationId: `baseline-delta-doc-${doc.documentId}`,
          entityType: 'document',
          entityId: doc.documentId,
          operation: 'UPSERT',
          baseVersion: doc.version ?? 1,
          clientTimestamp: localHlc,
          payload: {
            documentId: doc.documentId,
            title: doc.title,
            content: doc.content,
            updatedAt: doc.updatedAt ?? new Date(0).toISOString(),
            version: doc.version ?? 1,
          },
        });
      }
    }

    // 2. Highlights
    for await (const hl of paginateTable(this.db.highlights, 100)) {
      const localHlc = deriveEntityHlc(hl.deletedAt ?? hl.createdAt, deviceId);
      const remoteHlc = remoteEntityHlcById.get(hl.id);
      if (!remoteHlc || compareHlc(localHlc, remoteHlc) > 0) {
        deltas.push({
          clientMutationId: `baseline-delta-hl-${hl.id}`,
          entityType: 'highlight',
          entityId: hl.id,
          operation: hl.deletedAt ? 'DELETE' : 'UPSERT',
          clientTimestamp: localHlc,
          payload: {
            id: hl.id,
            documentId: hl.documentId,
            start: hl.start,
            end: hl.end,
            color: hl.color,
            text: hl.text,
            createdAt: hl.createdAt,
            deletedAt: hl.deletedAt,
          },
        });
      }
    }

    // 3. Drawings
    for await (const dr of paginateTable(this.db.drawings, 100)) {
      const localHlc = deriveEntityHlc(dr.deletedAt ?? dr.createdAt, deviceId);
      const remoteHlc = remoteEntityHlcById.get(dr.id);
      if (!remoteHlc || compareHlc(localHlc, remoteHlc) > 0) {
        deltas.push({
          clientMutationId: `baseline-delta-dr-${dr.id}`,
          entityType: 'drawing',
          entityId: dr.id,
          operation: dr.deletedAt ? 'DELETE' : 'UPSERT',
          clientTimestamp: localHlc,
          payload: {
            id: dr.id,
            documentId: dr.documentId,
            color: dr.color,
            thickness: dr.thickness,
            points: dr.points,
            isEraser: dr.isEraser,
            createdAt: dr.createdAt,
            deletedAt: dr.deletedAt,
          },
        });
      }
    }

    // 4. Flashcard Reviews
    for await (const fc of paginateTable(this.db.flashcardReviews, 100)) {
      const localHlc = deriveEntityHlc(fc.lastReviewedAt ?? fc.dueAt, deviceId);
      const remoteHlc = remoteEntityHlcById.get(fc.key);
      if (!remoteHlc || compareHlc(localHlc, remoteHlc) > 0) {
        deltas.push({
          clientMutationId: `baseline-delta-fc-${fc.key}`,
          entityType: 'flashcardReview',
          entityId: fc.key,
          operation: 'UPSERT',
          clientTimestamp: localHlc,
          payload: {
            key: fc.key,
            materialId: fc.materialId,
            repetitions: fc.repetitions,
            easeFactor: fc.easeFactor,
            intervalDays: fc.intervalDays,
            dueAt: fc.dueAt,
            lapses: fc.lapses,
            lastReviewedAt: fc.lastReviewedAt,
            reviewCount: fc.reviewCount,
          },
        });
      }
    }

    // 5. Quiz Sessions
    for await (const qs of paginateTable(this.db.quizSessions, 100)) {
      const localHlc = deriveEntityHlc(qs.completedAt ?? qs.startedAt, deviceId);
      const remoteHlc = remoteEntityHlcById.get(qs.id);
      if (!remoteHlc || compareHlc(localHlc, remoteHlc) > 0) {
        deltas.push({
          clientMutationId: `baseline-delta-qs-${qs.id}`,
          entityType: 'quizSession',
          entityId: qs.id,
          operation: 'APPEND',
          clientTimestamp: localHlc,
          payload: {
            id: qs.id,
            quizId: qs.quizId,
            mode: qs.mode,
            status: qs.status,
            questionSnapshots: qs.questionSnapshots,
            answers: qs.answers,
            score: qs.score,
            startedAt: qs.startedAt,
            completedAt: qs.completedAt,
          },
        });
      }
    }
  }

  private async enqueuePointerOperation(payload: SyncPointerPayload): Promise<void> {
    if (this.hydrationManager) {
      await this.hydrationManager.enqueuePointer(payload);
      this.hydrationManager.notify();
    } else {
      const existing = await this.db.pendingHydrations.get(payload.originShareId);
      if (!existing) {
        await this.db.pendingHydrations.put({
          originShareId: payload.originShareId,
          attempts: 0,
          nextAttemptAt: 0,
          title: payload.title,
          publishedAt: payload.publishedAt,
          schemaVersion: payload.schemaVersion,
        });
      }
    }
  }
}

/**
 * Singleton GoogleDriveSyncTransport instance.
 */
export const googleDriveSyncTransport = new GoogleDriveSyncTransport();
