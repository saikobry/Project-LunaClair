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

export interface JournalPayload {
  hlc: string;
  deviceId: string;
  createdAt: string;
  mutations: SyncMutation[];
}

export interface GoogleDriveSyncTransportOptions {
  driveClient?: GoogleDrivePort;
  authService?: GoogleAuthPort;
  hlc?: HybridLogicalClock;
}

export class GoogleDriveSyncTransport implements SyncTransport {
  private readonly driveClient: GoogleDrivePort;
  private readonly authService: GoogleAuthPort;
  private readonly hlcs: Map<string, HybridLogicalClock>;
  private readonly pageTokens: Map<string, string>;
  private readonly appliedFileIds: Set<string>;
  private readonly peerWatermarks: Record<string, string>;
  private currentSequence: number;
  private pushSequence: number;

  constructor(options: GoogleDriveSyncTransportOptions = {}) {
    this.driveClient = options.driveClient ?? googleDriveClient;
    this.authService = options.authService ?? googleAuthService;
    this.hlcs = new Map();
    if (options.hlc) {
      this.hlcs.set('default', options.hlc);
    }
    this.pageTokens = new Map();
    this.appliedFileIds = new Set();
    this.peerWatermarks = {};
    this.currentSequence = 0;
    this.pushSequence = 0;
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
      this.appliedFileIds.add(uploadedFile.id);
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

    if (!pageToken) {
      pageToken = await this.driveClient.getStartPageToken(accessToken);
      this.pageTokens.set(tokenKey, pageToken);
    }

    let changesResponse: DriveChangesResponse;
    let recoveredMissingFiles: DriveFileMetadata[] = [];

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
      } else {
        throw err;
      }
    }

    signal?.throwIfAborted();

    interface JournalCandidate {
      fileId: string;
      metadata: DriveFileMetadata;
    }

    const candidates: JournalCandidate[] = [];

    for (const change of changesResponse.changes) {
      if (change.removed) {
        continue;
      }
      if (!change.file) {
        continue;
      }
      if (this.isJournalFile(change.file) && !this.appliedFileIds.has(change.file.id)) {
        candidates.push({ fileId: change.file.id, metadata: change.file });
      }
    }

    for (const file of recoveredMissingFiles) {
      if (this.isJournalFile(file) && !this.appliedFileIds.has(file.id)) {
        candidates.push({ fileId: file.id, metadata: file });
      }
    }

    // Sort candidates deterministically by HLC timestamp
    candidates.sort((a, b) => {
      const hlca = a.metadata.appProperties?.hlc ?? a.metadata.name;
      const hlcb = b.metadata.appProperties?.hlc ?? b.metadata.name;
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
        this.appliedFileIds.add(candidate.fileId);
        continue;
      }

      this.appliedFileIds.add(candidate.fileId);

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
