/**
 * Google Drive appDataFolder compactor implementing snapshotting and cushion
 * management per ADR-018 and the BYOS Google Drive sync architecture.
 *
 * Responsibilities:
 * 1. 1 MB reserve slot cushion (reserve_slot.bin) provisioning & recovery.
 * 2. Threshold evaluation (active journal count > 40 or total size > 5 MB).
 * 3. Write-ahead immutable snapshotting (snapshot_{hlc}.json.gz).
 * 4. Safe deletion with 10-minute tail grace window (2 most recent journals preserved).
 * 5. 100% storage quota escape hatch (deletes cushion, retries snapshot, recovers cushion).
 */
import type {
  GoogleDrivePort,
  DriveFileMetadata,
} from '../../../domain/drive/models/drive.types';
import {
  DriveQuotaExceededError,
} from '../../../domain/drive/models/drive.types';
import type { GoogleAuthPort } from '../../../domain/auth/models/auth.types';
import {
  createHlc,
  compareHlc,
  parseHlc,
  type HybridLogicalClock,
} from '../../../domain/sync/utils/hlc';

export const COMPACTION_JOURNAL_COUNT_THRESHOLD = 40;
export const COMPACTION_TOTAL_SIZE_BYTES_THRESHOLD = 5 * 1024 * 1024; // 5 MB
export const TAIL_GRACE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const MIN_RECENT_JOURNALS_TO_KEEP = 2;
export const RESERVE_SLOT_SIZE_BYTES = 1024 * 1024; // 1 MB
export const RESERVE_SLOT_FILENAME = 'reserve_slot.bin';

export interface SnapshotPayload<T = unknown> {
  version: 1;
  hlc: string;
  deviceId: string;
  coveredJournalFileIds: string[];
  watermarks: Record<string, string>;
  state: T;
}

export interface DriveCompactorOptions {
  driveClient: GoogleDrivePort;
  authService: GoogleAuthPort;
  deviceId?: string;
  hlc?: HybridLogicalClock;
  clock?: () => Date;
  journalCountThreshold?: number;
  totalSizeBytesThreshold?: number;
  tailGraceWindowMs?: number;
  minRecentJournalsToKeep?: number;
}

export interface CompactionOptions {
  deviceId?: string;
  hlc?: string;
  state?: unknown;
  watermarks?: Record<string, string>;
  files?: DriveFileMetadata[];
  coveredJournalFileIds?: string[];
  force?: boolean;
  accessToken?: string;
}

export interface CompactionResult {
  compacted: boolean;
  reason?: 'below_threshold' | 'no_eligible_journals' | 'success';
  snapshotFile?: DriveFileMetadata;
  coveredJournalFileIds: string[];
  deletedJournalFileIds: string[];
  deletedSnapshotFileIds: string[];
  reserveSlotRecovered?: boolean;
}

/**
 * Checks whether a newer snapshot's coverage strictly dominates an older snapshot's coverage.
 */
export function dominatesCoverage(
  newSnapshot: { coveredJournalFileIds: string[]; watermarks?: Record<string, string>; hlc?: string },
  olderSnapshot: { coveredJournalFileIds: string[]; watermarks?: Record<string, string>; hlc?: string }
): boolean {
  if (!olderSnapshot.coveredJournalFileIds || !newSnapshot.coveredJournalFileIds) {
    return false;
  }
  const newCoveredSet = new Set(newSnapshot.coveredJournalFileIds);
  const dominatesCovered = olderSnapshot.coveredJournalFileIds.every((id) =>
    newCoveredSet.has(id)
  );
  if (!dominatesCovered) {
    return false;
  }
  if (olderSnapshot.watermarks && newSnapshot.watermarks) {
    for (const [deviceId, olderWm] of Object.entries(olderSnapshot.watermarks)) {
      const newWm = newSnapshot.watermarks[deviceId];
      if (!newWm || compareHlc(newWm, olderWm) < 0) {
        return false;
      }
    }
  }
  return true;
}

export class DriveCompactor {
  private readonly driveClient: GoogleDrivePort;
  private readonly authService: GoogleAuthPort;
  private readonly deviceId: string;
  private readonly hlc?: HybridLogicalClock;
  private readonly clock: () => Date;
  private readonly journalCountThreshold: number;
  private readonly totalSizeBytesThreshold: number;
  private readonly tailGraceWindowMs: number;
  private readonly minRecentJournalsToKeep: number;

  constructor(options: DriveCompactorOptions) {
    this.driveClient = options.driveClient;
    this.authService = options.authService;
    this.deviceId = options.deviceId ?? 'device-compactor';
    this.hlc = options.hlc;
    this.clock = options.clock ?? (() => new Date());
    this.journalCountThreshold = options.journalCountThreshold ?? COMPACTION_JOURNAL_COUNT_THRESHOLD;
    this.totalSizeBytesThreshold = options.totalSizeBytesThreshold ?? COMPACTION_TOTAL_SIZE_BYTES_THRESHOLD;
    this.tailGraceWindowMs = options.tailGraceWindowMs ?? TAIL_GRACE_WINDOW_MS;
    this.minRecentJournalsToKeep = options.minRecentJournalsToKeep ?? MIN_RECENT_JOURNALS_TO_KEEP;
  }

  /**
   * Verifies or provisions a 1 MB dummy file named reserve_slot.bin in appDataFolder.
   */
  async ensureReserveSlot(accessToken?: string): Promise<DriveFileMetadata> {
    const token = accessToken ?? (await this.authService.getValidAccessToken());
    const files = await this.driveClient.listFiles(token);
    const existing = files.find(
      (f) =>
        !f.trashed &&
        (f.name === RESERVE_SLOT_FILENAME || f.appProperties?.type === 'reserve')
    );

    if (existing) {
      return existing;
    }

    const dummyContent = new Uint8Array(RESERVE_SLOT_SIZE_BYTES);
    return await this.driveClient.uploadFile({
      name: RESERVE_SLOT_FILENAME,
      content: dummyContent,
      mimeType: 'application/octet-stream',
      compress: false,
      parents: ['appDataFolder'],
      appProperties: { type: 'reserve' },
      accessToken: token,
    });
  }

  /**
   * Determines if a file is an active journal file.
   */
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

  /**
   * Determines if a file is an active snapshot file.
   */
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

  /**
   * Evaluates if active journals exceed the threshold (> 40 files or > 5 MB).
   */
  isThresholdExceeded(files: DriveFileMetadata[]): boolean {
    const activeJournals = files.filter((f) => this.isJournalFile(f));
    if (activeJournals.length > this.journalCountThreshold) {
      return true;
    }
    const totalSize = activeJournals.reduce(
      (acc, f) => acc + (f.size ? Number(f.size) : 0),
      0
    );
    return totalSize > this.totalSizeBytesThreshold;
  }

  /**
   * Asynchronously checks whether compaction should be triggered.
   */
  async shouldCompact(files?: DriveFileMetadata[], accessToken?: string): Promise<boolean> {
    const allFiles = files ?? (await this.driveClient.listFiles(
      accessToken ?? (await this.authService.getValidAccessToken())
    ));
    return this.isThresholdExceeded(allFiles);
  }

  /**
   * Sorts journal files deterministically in chronological order.
   */
  sortJournalsChronologically(journals: DriveFileMetadata[]): DriveFileMetadata[] {
    return [...journals].sort((a, b) => {
      const hlca = a.appProperties?.hlc;
      const hlcb = b.appProperties?.hlc;
      if (hlca && hlcb) {
        return compareHlc(hlca, hlcb);
      }
      const timeA = a.createdTime ? new Date(a.createdTime).getTime() : 0;
      const timeB = b.createdTime ? new Date(b.createdTime).getTime() : 0;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  /**
   * Determines whether a journal is inside the tail grace window (2 most recent or < 10 mins old).
   */
  isJournalInTailGraceWindow(
    journal: DriveFileMetadata,
    sortedJournals: DriveFileMetadata[],
    now: Date
  ): boolean {
    const recentThresholdIndex = Math.max(0, sortedJournals.length - this.minRecentJournalsToKeep);
    const indexInSorted = sortedJournals.findIndex((j) => j.id === journal.id);
    if (indexInSorted >= recentThresholdIndex) {
      return true;
    }

    let journalTime: number | null = null;
    if (journal.appProperties?.hlc) {
      try {
        const parsed = parseHlc(journal.appProperties.hlc);
        const parsedTime = new Date(parsed.physical).getTime();
        if (!Number.isNaN(parsedTime)) {
          journalTime = parsedTime;
        }
      } catch {
        // Fallback to createdTime
      }
    }
    if (journalTime === null && journal.createdTime) {
      const parsedTime = new Date(journal.createdTime).getTime();
      if (!Number.isNaN(parsedTime)) {
        journalTime = parsedTime;
      }
    }

    if (journalTime !== null) {
      const ageMs = now.getTime() - journalTime;
      if (ageMs < this.tailGraceWindowMs) {
        return true;
      }
    }

    return false;
  }

  /**
   * Partitions journals into eligible for compaction and tail-grace protected.
   */
  getEligibleJournals(
    allJournals: DriveFileMetadata[],
    now: Date = this.clock()
  ): { eligible: DriveFileMetadata[]; protectedJournals: DriveFileMetadata[] } {
    const sorted = this.sortJournalsChronologically(allJournals.filter((j) => this.isJournalFile(j)));
    const eligible: DriveFileMetadata[] = [];
    const protectedJournals: DriveFileMetadata[] = [];

    for (const journal of sorted) {
      if (this.isJournalInTailGraceWindow(journal, sorted, now)) {
        protectedJournals.push(journal);
      } else {
        eligible.push(journal);
      }
    }

    return { eligible, protectedJournals };
  }

  /**
   * Executes compaction with write-ahead immutable snapshotting and safe tail deletion.
   */
  async compact(options: CompactionOptions = {}): Promise<CompactionResult> {
    const token = options.accessToken ?? (await this.authService.getValidAccessToken());
    const allFiles = options.files ?? (await this.driveClient.listFiles(token));

    const force = options.force ?? false;
    if (!force && !this.isThresholdExceeded(allFiles)) {
      return {
        compacted: false,
        reason: 'below_threshold',
        coveredJournalFileIds: [],
        deletedJournalFileIds: [],
        deletedSnapshotFileIds: [],
      };
    }

    const now = this.clock();
    const sortedJournals = this.sortJournalsChronologically(
      allFiles.filter((f) => this.isJournalFile(f))
    );

    let coveredJournalFileIds: string[];
    if (options.coveredJournalFileIds) {
      coveredJournalFileIds = options.coveredJournalFileIds;
    } else {
      const { eligible } = this.getEligibleJournals(allFiles, now);
      coveredJournalFileIds = eligible.map((j) => j.id);
    }

    if (coveredJournalFileIds.length === 0) {
      return {
        compacted: false,
        reason: 'no_eligible_journals',
        coveredJournalFileIds: [],
        deletedJournalFileIds: [],
        deletedSnapshotFileIds: [],
      };
    }

    const deviceId = options.deviceId ?? this.deviceId;
    const hlc = options.hlc ?? this.getHlc(deviceId).now();

    const watermarks: Record<string, string> = { ...(options.watermarks ?? {}) };
    for (const journal of sortedJournals) {
      if (coveredJournalFileIds.includes(journal.id)) {
        const jDev = journal.appProperties?.deviceId;
        const jHlc = journal.appProperties?.hlc;
        if (jDev && jHlc) {
          if (!watermarks[jDev] || compareHlc(jHlc, watermarks[jDev]) > 0) {
            watermarks[jDev] = jHlc;
          }
        }
      }
    }

    const snapshotPayload: SnapshotPayload = {
      version: 1,
      hlc,
      deviceId,
      coveredJournalFileIds,
      watermarks,
      state: options.state ?? null,
    };

    const appProperties: Record<string, string> = {
      type: 'snapshot',
      hlc,
      deviceId,
      coveredCount: String(coveredJournalFileIds.length),
    };

    const snapshotName = `snapshot_${hlc}.json.gz`;
    let snapshotFile: DriveFileMetadata;
    let reserveSlotRecovered = false;

    try {
      snapshotFile = await this.uploadSnapshot(
        snapshotName,
        snapshotPayload,
        appProperties,
        token
      );
    } catch (err) {
      if (this.isQuotaExceededError(err)) {
        // 100% Storage Quota Escape Hatch:
        // 1. Delete reserve_slot.bin (frees 1 MB)
        await this.deleteReserveSlot(token, allFiles);
        reserveSlotRecovered = true;

        // 2. Re-attempt creating the new snapshot
        snapshotFile = await this.uploadSnapshot(
          snapshotName,
          snapshotPayload,
          appProperties,
          token
        );
      } else {
        throw err;
      }
    }

    // 3. Delete covered journals (only those in coveredJournalFileIds and not in tail grace window)
    const deletedJournalFileIds = await this.deleteCoveredJournals(
      coveredJournalFileIds,
      sortedJournals,
      now,
      token
    );

    // Dominated older snapshots cleanup
    const deletedSnapshotFileIds = await this.cleanupDominatedSnapshots(
      snapshotPayload,
      allFiles,
      snapshotFile.id,
      token
    );

    // 4. Ensure reserve_slot.bin is re-allocated/verified
    await this.ensureReserveSlot(token);

    return {
      compacted: true,
      reason: 'success',
      snapshotFile,
      coveredJournalFileIds,
      deletedJournalFileIds,
      deletedSnapshotFileIds,
      reserveSlotRecovered,
    };
  }

  private async uploadSnapshot(
    name: string,
    payload: SnapshotPayload,
    appProperties: Record<string, string>,
    accessToken: string
  ): Promise<DriveFileMetadata> {
    if (typeof this.driveClient.uploadCompressedJson === 'function') {
      return await this.driveClient.uploadCompressedJson(
        name,
        payload,
        appProperties,
        accessToken,
        ['appDataFolder']
      );
    }
    return await this.driveClient.uploadFile({
      name,
      content: JSON.stringify(payload),
      compress: true,
      parents: ['appDataFolder'],
      appProperties,
      accessToken,
    });
  }

  private async deleteReserveSlot(
    accessToken: string,
    cachedFiles?: DriveFileMetadata[]
  ): Promise<boolean> {
    let files = cachedFiles;
    let reserveFile = files?.find(
      (f) =>
        !f.trashed &&
        (f.name === RESERVE_SLOT_FILENAME || f.appProperties?.type === 'reserve')
    );

    if (!reserveFile) {
      files = await this.driveClient.listFiles(accessToken);
      reserveFile = files.find(
        (f) =>
          !f.trashed &&
          (f.name === RESERVE_SLOT_FILENAME || f.appProperties?.type === 'reserve')
      );
    }

    if (reserveFile?.id) {
      await this.driveClient.deleteFile(reserveFile.id, accessToken);
      return true;
    }
    return false;
  }

  private async deleteCoveredJournals(
    coveredJournalFileIds: string[],
    sortedJournals: DriveFileMetadata[],
    now: Date,
    accessToken: string
  ): Promise<string[]> {
    const deletedIds: string[] = [];
    const coveredSet = new Set(coveredJournalFileIds);

    for (const journal of sortedJournals) {
      if (!coveredSet.has(journal.id)) {
        continue;
      }
      if (this.isJournalInTailGraceWindow(journal, sortedJournals, now)) {
        continue;
      }
      try {
        await this.driveClient.deleteFile(journal.id, accessToken);
        deletedIds.push(journal.id);
      } catch {
        // Continue attempting to delete remaining journals
      }
    }

    return deletedIds;
  }

  private async cleanupDominatedSnapshots(
    newPayload: SnapshotPayload,
    allFiles: DriveFileMetadata[],
    newSnapshotFileId: string | undefined,
    accessToken: string
  ): Promise<string[]> {
    const olderSnapshots = allFiles.filter(
      (f) => !f.trashed && this.isSnapshotFile(f) && f.id !== newSnapshotFileId
    );

    const deletedSnapshotFileIds: string[] = [];

    for (const snap of olderSnapshots) {
      try {
        let olderPayload: SnapshotPayload;
        if (typeof this.driveClient.downloadCompressedJson === 'function') {
          olderPayload = await this.driveClient.downloadCompressedJson<SnapshotPayload>(
            snap.id,
            accessToken
          );
        } else {
          const text = await this.driveClient.downloadFile(snap.id, accessToken, {
            decompress: true,
          });
          olderPayload = JSON.parse(text) as SnapshotPayload;
        }

        if (dominatesCoverage(newPayload, olderPayload)) {
          await this.driveClient.deleteFile(snap.id, accessToken);
          deletedSnapshotFileIds.push(snap.id);
        }
      } catch {
        // If cannot download or parse, preserve older snapshot safely
      }
    }

    return deletedSnapshotFileIds;
  }

  private isQuotaExceededError(err: unknown): boolean {
    if (err instanceof DriveQuotaExceededError) {
      return true;
    }
    if (typeof err === 'object' && err !== null) {
      const errorObj = err as { name?: string; status?: number; message?: string };
      if (errorObj.name === 'DriveQuotaExceededError') {
        return true;
      }
      if (
        errorObj.status === 403 &&
        typeof errorObj.message === 'string' &&
        errorObj.message.includes('quota')
      ) {
        return true;
      }
    }
    return false;
  }

  private getHlc(deviceId: string): HybridLogicalClock {
    if (this.hlc && this.hlc.deviceId === deviceId) {
      return this.hlc;
    }
    return createHlc(deviceId, this.clock);
  }
}
