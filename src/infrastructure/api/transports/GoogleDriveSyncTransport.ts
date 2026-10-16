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
import type { SyncStateRepository } from '../../../domain/sync/repositories/SyncStateRepository';
import { dexieSyncStateRepository } from '../../database/repositories/DexieSyncStateRepository';
import { getActiveVaultDatabase, type LunaClairDatabase } from '../../database/schema/LunaClairDatabase';
import {
  collectVaultChunksGzipped,
  deriveEntityHlc,
  paginateTable,
} from '../google/streamVaultChunksGzipped';

export interface JournalPayload {
  hlc: string;
  deviceId: string;
  createdAt: string;
  mutations: SyncMutation[];
}

export const MAX_PERSISTED_APPLIED_FILES = 1000;

export interface GoogleDriveSyncTransportOptions {
  driveClient?: GoogleDrivePort;
  authService?: GoogleAuthPort;
  hlc?: HybridLogicalClock;
  stateRepo?: SyncStateRepository;
  db?: LunaClairDatabase;
  onTokenExpired?: () => Promise<string>;
}

export class GoogleDriveSyncTransport implements SyncTransport {
  private readonly driveClient: GoogleDrivePort;
  private readonly authService: GoogleAuthPort;
  private readonly stateRepo: SyncStateRepository;
  private readonly db: LunaClairDatabase;
  private readonly hlcs: Map<string, HybridLogicalClock>;
  private readonly pageTokens: Map<string, string>;
  private readonly appliedFileIds: Set<string>;
  private readonly peerWatermarks: Record<string, string>;
  private currentSequence: number;
  private pushSequence: number;
  private driveSeeded: boolean;

  constructor(options: GoogleDriveSyncTransportOptions = {}) {
    this.driveClient = options.driveClient ?? googleDriveClient;
    this.authService = options.authService ?? googleAuthService;
    this.stateRepo = options.stateRepo ?? dexieSyncStateRepository;
    this.db = options.db ?? getActiveVaultDatabase();
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

    // Wire automatic token refresh callback on HTTP 401
    const refreshCallback = options.onTokenExpired ?? (async (): Promise<string> => {
      if (typeof this.authService.refreshAccessToken === 'function') {
        return this.authService.refreshAccessToken();
      }
      return this.authService.getValidAccessToken(true);
    });

    if (typeof this.driveClient.setOnTokenExpired === 'function') {
      this.driveClient.setOnTokenExpired(refreshCallback);
    } else if ('onTokenExpired' in this.driveClient) {
      this.driveClient.onTokenExpired = refreshCallback;
    }
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

    await this.loadStateForCredentials(credentials);
    signal?.throwIfAborted();

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
      await this.saveStateForCredentials(credentials);
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

    await this.loadStateForCredentials(credentials);
    signal?.throwIfAborted();

    const accessToken = await this.authService.getValidAccessToken();
    signal?.throwIfAborted();

    const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
    let pageToken = this.pageTokens.get(tokenKey);

    let changesResponse: DriveChangesResponse;
    let recoveredMissingFiles: DriveFileMetadata[] = [];
    let pendingTokenToCommit: string | undefined;

    if (!pageToken) {
      // Cursor-First Hydration Invariant:
      // 1. Call candidateToken = await this.driveClient.getStartPageToken(accessToken) FIRST at t0.
      const candidateToken = await this.driveClient.getStartPageToken(accessToken);
      pendingTokenToCommit = candidateToken;

      // 2. Call allFiles = await this.driveClient.listFiles(accessToken) at t1.
      const allFiles = await this.driveClient.listFiles(accessToken);

      // Baseline Seeding: Cold remote check when not yet driveSeeded
      if (!this.driveSeeded) {
        const syncFiles = allFiles.filter(
          (file) => !file.trashed && this.isSyncFile(file)
        );
        if (syncFiles.length === 0) {
          // Cold Remote: seed Dexie vault as baseline snapshot
          await this.seedColdRemote(credentials, accessToken, signal);
        }
      }

      // 3. Discover all existing unapplied sync files in appDataFolder to hydrate past journals/snapshots.
      for (const file of allFiles) {
        if (this.isSyncFile(file) && !this.appliedFileIds.has(file.id)) {
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
        changesResponse = await this.driveClient.listChanges(pageToken, accessToken);
        pendingTokenToCommit = changesResponse.nextPageToken ?? changesResponse.newStartPageToken;
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
        this.isSyncFile(file) &&
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
      } catch (err) {
        if (this.isCorruptedFileError(err)) {
          // Prevent repeated failures on corrupted file
          this.markFileApplied(candidate.fileId);
          continue;
        }
        throw err;
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

    // Baseline Seeding: Warm remote check when not yet driveSeeded
    if (!this.driveSeeded) {
      await this.seedWarmRemoteDeltas(credentials, changes, accessToken, signal);
      this.driveSeeded = true;
    }

    // Only after downloading and applying hydrated files, commit pageToken and persist transport state
    const tokenToCommit =
      pendingTokenToCommit ?? changesResponse.nextPageToken ?? changesResponse.newStartPageToken;
    if (tokenToCommit) {
      this.pageTokens.set(tokenKey, tokenToCommit);
    }

    await this.saveStateForCredentials(credentials);

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
    void this.saveStateForCredentials({ userId, deviceId, token: '' });
  }

  /**
   * Clears in-memory and persisted transport state (for testing / logout).
   */
  clearState(credentials?: SessionCredentials): void {
    void this.clearStateAsync(credentials);
  }

  isDriveSeeded(): boolean {
    return this.driveSeeded;
  }

  setDriveSeeded(seeded: boolean): void {
    this.driveSeeded = seeded;
  }

  async clearStateAsync(credentials?: SessionCredentials): Promise<void> {
    this.pageTokens.clear();
    this.appliedFileIds.clear();
    this.driveSeeded = false;
    for (const key of Object.keys(this.peerWatermarks)) {
      delete this.peerWatermarks[key];
    }
    if (credentials) {
      const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
      try {
        const existing = await this.stateRepo.getSyncState(tokenKey);
        if (existing) {
          await this.stateRepo.saveSyncState({
            ...existing,
            pageToken: undefined,
            appliedFileIds: [],
            peerWatermarks: {},
            driveSeeded: false,
          });
        }
      } catch {
        // Non-fatal
      }
    }
  }

  private async loadStateForCredentials(credentials: SessionCredentials): Promise<void> {
    const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
    try {
      const stored = await this.stateRepo.getSyncState(tokenKey);
      if (stored) {
        if (typeof stored.driveSeeded === 'boolean') {
          this.driveSeeded = stored.driveSeeded;
        }
        if (stored.pageToken && !this.pageTokens.has(tokenKey)) {
          this.pageTokens.set(tokenKey, stored.pageToken);
        }
        if (Array.isArray(stored.appliedFileIds)) {
          for (const id of stored.appliedFileIds) {
            if (typeof id === 'string') {
              this.markFileApplied(id);
            }
          }
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

  private async saveStateForCredentials(credentials: SessionCredentials): Promise<void> {
    const tokenKey = `${credentials.userId}:${credentials.deviceId}`;
    try {
      const existing = await this.stateRepo.getSyncState(tokenKey);
      const pageToken = this.pageTokens.get(tokenKey);
      const appliedList = Array.from(this.appliedFileIds).slice(-MAX_PERSISTED_APPLIED_FILES);

      const state: SyncState = {
        key: tokenKey,
        userId: credentials.userId,
        deviceId: credentials.deviceId,
        lastServerCursor: existing?.lastServerCursor ?? 0,
        lastSyncedAt: existing?.lastSyncedAt,
        pageToken: pageToken ?? existing?.pageToken,
        appliedFileIds: appliedList,
        peerWatermarks: { ...this.peerWatermarks },
        driveSeeded: this.driveSeeded || Boolean(existing?.driveSeeded),
      };

      await this.stateRepo.saveSyncState(state);
    } catch {
      // Storage quota or IndexedDB transaction errors must not crash sync
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
          ['appDataFolder']
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
        });
      }

      if (uploadedFile?.id) {
        this.markFileApplied(uploadedFile.id);
      }
    }

    this.driveSeeded = true;
    await this.saveStateForCredentials(credentials);
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

      if (uploadedFile?.id) {
        this.markFileApplied(uploadedFile.id);
      }
    }

    this.driveSeeded = true;
    await this.saveStateForCredentials(credentials);
  }

  private async collectLocalDeltas(
    remoteEntityHlcById: Map<string, string>,
    deltas: SyncMutation[],
    deviceId: string
  ): Promise<void> {
    // 1. Documents
    for await (const doc of paginateTable(this.db.documentContents, 100)) {
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
}

/**
 * Singleton GoogleDriveSyncTransport instance.
 */
export const googleDriveSyncTransport = new GoogleDriveSyncTransport();
