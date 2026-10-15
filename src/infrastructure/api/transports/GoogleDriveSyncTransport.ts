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
import { DriveHttpError } from '../../../domain/drive/models/drive.types';
import type { GoogleAuthPort } from '../../../domain/auth/models/auth.types';
import { googleDriveClient } from '../google/GoogleDriveClient';
import { googleAuthService } from '../../auth/google/GoogleAuthService';
import {
  createHlc,
  compareHlc,
  type HybridLogicalClock,
} from '../../../domain/sync/utils/hlc';
import { STORAGE_KEYS } from '../../../shared/constants/storageKeys';

export interface JournalPayload {
  hlc: string;
  deviceId: string;
  createdAt: string;
  mutations: SyncMutation[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const MAX_PERSISTED_APPLIED_FILES = 1000;

interface PersistedGDriveTransportState {
  pageTokens?: Record<string, string>;
  appliedFileIds?: string[];
  peerWatermarks?: Record<string, string>;
}

export interface GoogleDriveSyncTransportOptions {
  driveClient?: GoogleDrivePort;
  authService?: GoogleAuthPort;
  hlc?: HybridLogicalClock;
  storage?: StorageLike;
}

export class GoogleDriveSyncTransport implements SyncTransport {
  private readonly driveClient: GoogleDrivePort;
  private readonly authService: GoogleAuthPort;
  private readonly storage?: StorageLike;
  private readonly hlcs: Map<string, HybridLogicalClock>;
  private readonly pageTokens: Map<string, string>;
  private readonly appliedFileIds: Set<string>;
  private readonly peerWatermarks: Record<string, string>;
  private currentSequence: number;
  private pushSequence: number;

  constructor(options: GoogleDriveSyncTransportOptions = {}) {
    this.driveClient = options.driveClient ?? googleDriveClient;
    this.authService = options.authService ?? googleAuthService;
    this.storage =
      options.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
    this.hlcs = new Map();
    if (options.hlc) {
      this.hlcs.set('default', options.hlc);
    }
    this.pageTokens = new Map();
    this.appliedFileIds = new Set();
    this.peerWatermarks = {};
    this.currentSequence = 0;
    this.pushSequence = 0;

    this.loadState();
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
    signal?.throwIfAborted();

    if (!request.mutations || request.mutations.length === 0) {
      return {
        accepted: [],
        conflicts: [],
        rejected: [],
      };
    }

    const accessToken = await this.authService.getValidAccessToken();
    signal?.throwIfAborted();

    const hlc = this.getHlc(credentials.deviceId);
    const currentHlc = hlc.now();
    this.pushSequence += 1;

    const fileName = `journal_${currentHlc}.json.gz`;
    const journalPayload: JournalPayload = {
      hlc: currentHlc,
      deviceId: credentials.deviceId,
      createdAt: new Date().toISOString(),
      mutations: request.mutations,
    };

    const appProperties: Record<string, string> = {
      type: 'journal',
      deviceId: credentials.deviceId,
      hlc: currentHlc,
      seq: String(this.pushSequence),
      count: String(request.mutations.length),
    };

    let uploadedFile: DriveFileMetadata;
    if (typeof this.driveClient.uploadCompressedJson === 'function') {
      uploadedFile = await this.driveClient.uploadCompressedJson(
        fileName,
        journalPayload,
        appProperties,
        accessToken,
        ['appDataFolder']
      );
    } else {
      uploadedFile = await this.driveClient.uploadFile({
        name: fileName,
        content: JSON.stringify(journalPayload),
        compress: true,
        parents: ['appDataFolder'],
        appProperties,
        accessToken,
      });
    }

    // Mark our uploaded file as applied to avoid re-ingesting our own journal on pull
    if (uploadedFile?.id) {
      this.markFileApplied(uploadedFile.id);
      this.saveState();
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
    signal?.throwIfAborted();

    const accessToken = await this.authService.getValidAccessToken();
    signal?.throwIfAborted();

    const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
    let pageToken = this.pageTokens.get(tokenKey);

    let changesResponse: DriveChangesResponse;
    let recoveredMissingFiles: DriveFileMetadata[] = [];

    if (!pageToken) {
      // Clean / first-time sync on new device/browser:
      // 1. Obtain fresh startPageToken first to anchor future incremental changes
      const newPageToken = await this.driveClient.getStartPageToken(accessToken);
      this.pageTokens.set(tokenKey, newPageToken);

      // 2. Discover all existing journal files in appDataFolder to hydrate past journals
      const existingFiles = await this.driveClient.listFiles(accessToken);
      for (const file of existingFiles) {
        if (this.isJournalFile(file) && !this.appliedFileIds.has(file.id)) {
          recoveredMissingFiles.push(file);
        }
      }

      changesResponse = {
        changes: [],
        newStartPageToken: newPageToken,
      };

      this.saveState();
    } else {
      try {
        changesResponse = await this.driveClient.listChanges(pageToken, accessToken);
      } catch (err) {
        if (this.is410Error(err)) {
          const recoveryParams: Recover410Params = {
            accessToken,
            appliedFileIds: this.appliedFileIds,
            peerWatermarks: this.peerWatermarks,
          };

          const recoveryResult: CursorRecoveryResult =
            typeof this.driveClient.recoverFromInvalidPageToken === 'function'
              ? await this.driveClient.recoverFromInvalidPageToken(recoveryParams)
              : await this.driveClient.recover410Cursor(recoveryParams);

          this.pageTokens.set(tokenKey, recoveryResult.newPageToken);
          changesResponse = {
            changes: [],
            newStartPageToken: recoveryResult.newPageToken,
          };
          recoveredMissingFiles = recoveryResult.missingFiles;
          this.saveState();
        } else {
          throw err;
        }
      }
    }

    signal?.throwIfAborted();

    interface JournalCandidate {
      fileId: string;
      metadata: DriveFileMetadata;
    }

    const candidates: JournalCandidate[] = [];
    const seenCandidateFileIds = new Set<string>();

    for (const change of changesResponse.changes) {
      if (change.removed) {
        continue;
      }
      if (!change.file) {
        continue;
      }
      if (
        this.isJournalFile(change.file) &&
        !this.appliedFileIds.has(change.file.id) &&
        !seenCandidateFileIds.has(change.file.id)
      ) {
        seenCandidateFileIds.add(change.file.id);
        candidates.push({ fileId: change.file.id, metadata: change.file });
      }
    }

    for (const file of recoveredMissingFiles) {
      if (
        this.isJournalFile(file) &&
        !this.appliedFileIds.has(file.id) &&
        !seenCandidateFileIds.has(file.id)
      ) {
        seenCandidateFileIds.add(file.id);
        candidates.push({ fileId: file.id, metadata: file });
      }
    }

    // Sort candidates deterministically by HLC timestamp
    candidates.sort((a, b) => {
      const hlca = this.extractHlc(a.metadata);
      const hlcb = this.extractHlc(b.metadata);
      return compareHlc(hlca, hlcb);
    });

    const changes: SyncChangeItem[] = [];
    const localHlc = this.getHlc(credentials.deviceId);

    for (const candidate of candidates) {
      signal?.throwIfAborted();

      let journal: JournalPayload;
      try {
        if (typeof this.driveClient.downloadCompressedJson === 'function') {
          journal = await this.driveClient.downloadCompressedJson<JournalPayload>(
            candidate.fileId,
            accessToken
          );
        } else {
          const text = await this.driveClient.downloadFile(candidate.fileId, accessToken, {
            decompress: true,
          });
          journal = JSON.parse(text) as JournalPayload;
        }
      } catch {
        // Prevent repeated failures on corrupted file
        this.markFileApplied(candidate.fileId);
        continue;
      }

      this.markFileApplied(candidate.fileId);

      const fileHlc = candidate.metadata.appProperties?.hlc ?? journal.hlc;
      const fileDeviceId = candidate.metadata.appProperties?.deviceId ?? journal.deviceId;

      if (fileHlc) {
        localHlc.receive(fileHlc);
      }

      if (fileDeviceId && fileHlc) {
        const currentWm = this.peerWatermarks[fileDeviceId];
        if (!currentWm || compareHlc(fileHlc, currentWm) > 0) {
          this.peerWatermarks[fileDeviceId] = fileHlc;
        }
      }

      if (Array.isArray(journal.mutations)) {
        for (const mutation of journal.mutations) {
          this.currentSequence = Math.max(this.currentSequence, cursor) + 1;
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
      }
    }

    const nextToken = changesResponse.nextPageToken ?? changesResponse.newStartPageToken;
    if (nextToken) {
      this.pageTokens.set(tokenKey, nextToken);
    }

    this.saveState();

    const returnedChanges =
      typeof limit === 'number' && limit > 0 ? changes.slice(0, limit) : changes;
    const hasMore =
      Boolean(changesResponse.nextPageToken) ||
      (typeof limit === 'number' && limit > 0 && changes.length > limit);
    const newCursor = cursor + returnedChanges.length;

    return {
      newCursor,
      hasMore,
      changes: returnedChanges,
    };
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
    this.saveState();
  }

  /**
   * Clears in-memory and persisted transport state (for testing / logout).
   */
  clearState(): void {
    this.pageTokens.clear();
    this.appliedFileIds.clear();
    for (const key of Object.keys(this.peerWatermarks)) {
      delete this.peerWatermarks[key];
    }
    try {
      this.storage?.removeItem?.(STORAGE_KEYS.sync.gdriveTransportState);
    } catch {
      // Ignore
    }
  }

  private loadState(): void {
    if (!this.storage) {
      return;
    }
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.sync.gdriveTransportState);
      if (!raw) {
        return;
      }
      const state = JSON.parse(raw) as PersistedGDriveTransportState;
      if (state && typeof state === 'object') {
        if (state.pageTokens && typeof state.pageTokens === 'object') {
          for (const [key, value] of Object.entries(state.pageTokens)) {
            if (typeof value === 'string') {
              this.pageTokens.set(key, value);
            }
          }
        }
        if (Array.isArray(state.appliedFileIds)) {
          const ids = state.appliedFileIds.slice(-MAX_PERSISTED_APPLIED_FILES);
          for (const id of ids) {
            if (typeof id === 'string') {
              this.appliedFileIds.add(id);
            }
          }
        }
        if (state.peerWatermarks && typeof state.peerWatermarks === 'object') {
          for (const [key, value] of Object.entries(state.peerWatermarks)) {
            if (typeof value === 'string') {
              this.peerWatermarks[key] = value;
            }
          }
        }
      }
    } catch {
      // Storage access or parse errors are non-fatal
    }
  }

  private saveState(): void {
    if (!this.storage) {
      return;
    }
    try {
      const pageTokensObj: Record<string, string> = {};
      for (const [key, value] of this.pageTokens.entries()) {
        pageTokensObj[key] = value;
      }

      const appliedList = Array.from(this.appliedFileIds).slice(-MAX_PERSISTED_APPLIED_FILES);

      const state: PersistedGDriveTransportState = {
        pageTokens: pageTokensObj,
        appliedFileIds: appliedList,
        peerWatermarks: { ...this.peerWatermarks },
      };

      this.storage.setItem(STORAGE_KEYS.sync.gdriveTransportState, JSON.stringify(state));
    } catch {
      // Storage quota or privacy sandbox errors must not crash sync
    }
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
    const match = /^journal_(.+)\.json\.gz$/.exec(metadata.name ?? '');
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

  private isJournalFile(file: DriveFileMetadata): boolean {
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
}

/**
 * Singleton GoogleDriveSyncTransport instance.
 */
export const googleDriveSyncTransport = new GoogleDriveSyncTransport();
