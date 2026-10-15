import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DriveCompactor,
  dominatesCoverage,
  RESERVE_SLOT_FILENAME,
  RESERVE_SLOT_SIZE_BYTES,
  type SnapshotPayload,
  type DriveCompactorOptions,
} from '../DriveCompactor';
import type {
  GoogleDrivePort,
  DriveFileMetadata,
} from '../../../../domain/drive/models/drive.types';
import {
  DriveQuotaExceededError,
  DriveHttpError,
} from '../../../../domain/drive/models/drive.types';
import type { GoogleAuthPort } from '../../../../domain/auth/models/auth.types';

describe('DriveCompactor', () => {
  let mockDriveClient: {
    generateFileId: ReturnType<typeof vi.fn>;
    uploadFile: ReturnType<typeof vi.fn>;
    downloadFile: ReturnType<typeof vi.fn>;
    downloadBinary: ReturnType<typeof vi.fn>;
    deleteFile: ReturnType<typeof vi.fn>;
    listFiles: ReturnType<typeof vi.fn>;
    getStartPageToken: ReturnType<typeof vi.fn>;
    listChanges: ReturnType<typeof vi.fn>;
    recover410Cursor: ReturnType<typeof vi.fn>;
    uploadCompressedJson?: ReturnType<typeof vi.fn>;
    downloadCompressedJson?: ReturnType<typeof vi.fn>;
  };

  let mockAuthService: {
    login: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    getValidAccessToken: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };

  const fixedNow = new Date('2026-10-15T12:00:00.000Z');

  beforeEach(() => {
    mockDriveClient = {
      generateFileId: vi.fn(),
      uploadFile: vi.fn(),
      downloadFile: vi.fn(),
      downloadBinary: vi.fn(),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      listFiles: vi.fn().mockResolvedValue([]),
      getStartPageToken: vi.fn(),
      listChanges: vi.fn(),
      recover410Cursor: vi.fn(),
      uploadCompressedJson: vi.fn(),
      downloadCompressedJson: vi.fn(),
    };

    mockAuthService = {
      login: vi.fn(),
      logout: vi.fn(),
      getValidAccessToken: vi.fn().mockResolvedValue('test-access-token'),
      getSession: vi.fn(),
      getStatus: vi.fn().mockReturnValue('authenticated'),
      subscribe: vi.fn(),
    };
  });

  const createCompactor = (options: Partial<DriveCompactorOptions> = {}) => {
    return new DriveCompactor({
      driveClient: mockDriveClient as unknown as GoogleDrivePort,
      authService: mockAuthService as unknown as GoogleAuthPort,
      deviceId: 'test-device-1',
      clock: () => fixedNow,
      ...options,
    });
  };

  describe('ensureReserveSlot (1 MB Cushion)', () => {
    it('provisions a 1 MB reserve_slot.bin file when absent', async () => {
      mockDriveClient.listFiles.mockResolvedValue([]);
      const createdMetadata: DriveFileMetadata = {
        id: 'reserve-file-123',
        name: RESERVE_SLOT_FILENAME,
        appProperties: { type: 'reserve' },
        size: String(RESERVE_SLOT_SIZE_BYTES),
      };
      mockDriveClient.uploadFile.mockResolvedValue(createdMetadata);

      const compactor = createCompactor();
      const result = await compactor.ensureReserveSlot('custom-token');

      expect(mockDriveClient.listFiles).toHaveBeenCalledWith('custom-token');
      expect(mockDriveClient.uploadFile).toHaveBeenCalledWith({
        name: RESERVE_SLOT_FILENAME,
        content: expect.any(Uint8Array),
        mimeType: 'application/octet-stream',
        compress: false,
        parents: ['appDataFolder'],
        appProperties: { type: 'reserve' },
        accessToken: 'custom-token',
      });

      const uploadedCall = mockDriveClient.uploadFile.mock.calls[0][0];
      expect((uploadedCall.content as Uint8Array).byteLength).toBe(RESERVE_SLOT_SIZE_BYTES);
      expect(result).toEqual(createdMetadata);
    });

    it('returns existing reserve_slot.bin without uploading if already present', async () => {
      const existingMetadata: DriveFileMetadata = {
        id: 'existing-reserve-file',
        name: RESERVE_SLOT_FILENAME,
        appProperties: { type: 'reserve' },
      };
      mockDriveClient.listFiles.mockResolvedValue([existingMetadata]);

      const compactor = createCompactor();
      const result = await compactor.ensureReserveSlot();

      expect(mockAuthService.getValidAccessToken).toHaveBeenCalled();
      expect(mockDriveClient.uploadFile).not.toHaveBeenCalled();
      expect(result).toEqual(existingMetadata);
    });
  });

  describe('Threshold Trigger', () => {
    it('does not trigger compaction when active journals <= 40 and size <= 5 MB', async () => {
      const compactor = createCompactor();
      const files: DriveFileMetadata[] = Array.from({ length: 40 }, (_, i) => ({
        id: `journal-${i}`,
        name: `journal_2026-10-15T11:00:00.000Z_0000_device-1.json.gz`,
        appProperties: { type: 'journal' },
        size: '10000', // 10 KB each = 400 KB total
      }));

      expect(compactor.isThresholdExceeded(files)).toBe(false);

      const shouldCompact = await compactor.shouldCompact(files);
      expect(shouldCompact).toBe(false);
    });

    it('triggers compaction when active journal count > 40', async () => {
      const compactor = createCompactor();
      const files: DriveFileMetadata[] = Array.from({ length: 41 }, (_, i) => ({
        id: `journal-${i}`,
        name: `journal_${i}.json.gz`,
        appProperties: { type: 'journal' },
        size: '1000',
      }));

      expect(compactor.isThresholdExceeded(files)).toBe(true);

      const shouldCompact = await compactor.shouldCompact(files);
      expect(shouldCompact).toBe(true);
    });

    it('triggers compaction when total journal size > 5 MB even if count <= 40', async () => {
      const compactor = createCompactor();
      const files: DriveFileMetadata[] = [
        {
          id: 'journal-1',
          name: 'journal_1.json.gz',
          appProperties: { type: 'journal' },
          size: String(3 * 1024 * 1024), // 3 MB
        },
        {
          id: 'journal-2',
          name: 'journal_2.json.gz',
          appProperties: { type: 'journal' },
          size: String(3 * 1024 * 1024), // 3 MB -> 6 MB total
        },
      ];

      expect(compactor.isThresholdExceeded(files)).toBe(true);
      expect(await compactor.shouldCompact(files)).toBe(true);
    });

    it('ignores trashed journals and non-journal files when evaluating threshold', () => {
      const compactor = createCompactor();
      const files: DriveFileMetadata[] = [
        ...Array.from({ length: 45 }, (_, i) => ({
          id: `trashed-journal-${i}`,
          name: `journal_${i}.json.gz`,
          appProperties: { type: 'journal' },
          trashed: true,
        })),
        {
          id: 'random-doc',
          name: 'doc.txt',
          size: String(10 * 1024 * 1024),
        },
      ];

      expect(compactor.isThresholdExceeded(files)).toBe(false);
    });
  });

  describe('Write-Ahead Immutable Snapshotting', () => {
    it('creates snapshot_${hlc}.json.gz with required header and appProperties before deleting journals', async () => {
      const callOrder: string[] = [];
      mockDriveClient.uploadCompressedJson?.mockImplementation(async (name, _payload, appProperties) => {
        callOrder.push('uploadSnapshot');
        return {
          id: 'snapshot-file-id-1',
          name,
          appProperties,
        };
      });
      mockDriveClient.deleteFile.mockImplementation(async (id) => {
        callOrder.push(`deleteFile:${id}`);
      });

      // 45 journals older than 10 minutes
      const files: DriveFileMetadata[] = Array.from({ length: 45 }, (_, i) => {
        const d = new Date(fixedNow.getTime() - (60 - i) * 60 * 1000); // 60 to 16 mins ago
        const hlc = `${d.toISOString()}_0000_device-1`;
        return {
          id: `journal-${i}`,
          name: `journal_${hlc}.json.gz`,
          createdTime: d.toISOString(),
          appProperties: { type: 'journal', hlc, deviceId: 'device-1' },
          size: '1000',
        };
      });

      const compactor = createCompactor();
      const result = await compactor.compact({
        files,
        state: { userEntities: { 'ent-1': 'data' } },
        watermarks: { 'device-1': '2026-10-15T11:44:00.000Z_0000_device-1' },
      });

      expect(result.compacted).toBe(true);
      expect(result.reason).toBe('success');
      expect(result.snapshotFile?.id).toBe('snapshot-file-id-1');

      // Verify write-ahead ordering: uploadSnapshot must happen before deleteFile
      expect(callOrder[0]).toBe('uploadSnapshot');
      expect(callOrder.some((c) => c.startsWith('deleteFile'))).toBe(true);

      // Verify payload passed to uploadCompressedJson
      const [snapName, payload, appProps] = mockDriveClient.uploadCompressedJson?.mock.calls[0] ?? [];
      expect(snapName).toMatch(/^snapshot_.*\.json\.gz$/);
      expect(payload).toEqual({
        version: 1,
        hlc: expect.any(String),
        deviceId: 'test-device-1',
        coveredJournalFileIds: expect.any(Array),
        watermarks: expect.objectContaining({ 'device-1': expect.any(String) }),
        state: { userEntities: { 'ent-1': 'data' } },
      });

      // AppProperties check
      expect(appProps).toEqual({
        type: 'snapshot',
        hlc: payload.hlc,
        deviceId: 'test-device-1',
        coveredCount: String(payload.coveredJournalFileIds.length),
      });
    });

    it('does not delete any journals if snapshot upload throws a generic network error', async () => {
      mockDriveClient.uploadCompressedJson?.mockRejectedValue(
        new DriveHttpError('Server Error', 500, 'Internal Server Error')
      );

      const files: DriveFileMetadata[] = Array.from({ length: 45 }, (_, i) => ({
        id: `journal-${i}`,
        name: `journal_${i}.json.gz`,
        appProperties: {
          type: 'journal',
          hlc: `2026-10-15T10:00:00.000Z_000${i}_device-1`,
        },
        size: '1000',
      }));

      const compactor = createCompactor();
      await expect(compactor.compact({ files })).rejects.toThrow('Server Error');

      expect(mockDriveClient.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('Safe Deletion with 10-Minute Tail Grace Window', () => {
    it('leaves journals created within the last 10 minutes and the 2 most recent journals undeleted', async () => {
      // 5 journals:
      // J0: 30 mins ago
      // J1: 25 mins ago
      // J2: 20 mins ago
      // J3: 5 mins ago (< 10 mins)
      // J4: 2 mins ago (< 10 mins, and in top 2 most recent)
      const journals: DriveFileMetadata[] = [
        {
          id: 'j0',
          name: 'journal_j0.json.gz',
          createdTime: new Date(fixedNow.getTime() - 30 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T11:30:00.000Z_0000_device-1' },
        },
        {
          id: 'j1',
          name: 'journal_j1.json.gz',
          createdTime: new Date(fixedNow.getTime() - 25 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T11:35:00.000Z_0000_device-1' },
        },
        {
          id: 'j2',
          name: 'journal_j2.json.gz',
          createdTime: new Date(fixedNow.getTime() - 20 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T11:40:00.000Z_0000_device-1' },
        },
        {
          id: 'j3',
          name: 'journal_j3.json.gz',
          createdTime: new Date(fixedNow.getTime() - 5 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T11:55:00.000Z_0000_device-1' },
        },
        {
          id: 'j4',
          name: 'journal_j4.json.gz',
          createdTime: new Date(fixedNow.getTime() - 2 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T11:58:00.000Z_0000_device-1' },
        },
      ];

      const compactor = createCompactor();
      const { eligible, protectedJournals } = compactor.getEligibleJournals(journals, fixedNow);

      expect(eligible.map((j) => j.id)).toEqual(['j0', 'j1', 'j2']);
      expect(protectedJournals.map((j) => j.id)).toEqual(['j3', 'j4']);

      mockDriveClient.uploadCompressedJson?.mockResolvedValue({ id: 'new-snap-id' });

      // Run compaction with force: true
      const result = await compactor.compact({ files: journals, force: true });

      expect(result.coveredJournalFileIds).toEqual(['j0', 'j1', 'j2']);
      expect(result.deletedJournalFileIds).toEqual(['j0', 'j1', 'j2']);

      // Ensure j3 and j4 were never deleted
      expect(mockDriveClient.deleteFile).toHaveBeenCalledWith('j0', expect.any(String));
      expect(mockDriveClient.deleteFile).toHaveBeenCalledWith('j1', expect.any(String));
      expect(mockDriveClient.deleteFile).toHaveBeenCalledWith('j2', expect.any(String));
      expect(mockDriveClient.deleteFile).not.toHaveBeenCalledWith('j3', expect.any(String));
      expect(mockDriveClient.deleteFile).not.toHaveBeenCalledWith('j4', expect.any(String));
    });

    it('preserves the 2 most recent journals even when older than 10 minutes', () => {
      // 3 journals, all created 2 hours ago
      const journals: DriveFileMetadata[] = [
        {
          id: 'j0',
          name: 'journal_0.json.gz',
          createdTime: new Date(fixedNow.getTime() - 120 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T10:00:00.000Z_0000_device-1' },
        },
        {
          id: 'j1',
          name: 'journal_1.json.gz',
          createdTime: new Date(fixedNow.getTime() - 110 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T10:10:00.000Z_0000_device-1' },
        },
        {
          id: 'j2',
          name: 'journal_2.json.gz',
          createdTime: new Date(fixedNow.getTime() - 100 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T10:20:00.000Z_0000_device-1' },
        },
      ];

      const compactor = createCompactor();
      const { eligible, protectedJournals } = compactor.getEligibleJournals(journals, fixedNow);

      // j1 and j2 are the 2 most recent, so only j0 is eligible
      expect(eligible.map((j) => j.id)).toEqual(['j0']);
      expect(protectedJournals.map((j) => j.id)).toEqual(['j1', 'j2']);
    });

    it('deletes older snapshots only if the new snapshot dominates their coverage', async () => {
      const olderSnapshotDominated: DriveFileMetadata = {
        id: 'older-snap-1',
        name: 'snapshot_old1.json.gz',
        appProperties: { type: 'snapshot' },
      };
      const olderSnapshotNotDominated: DriveFileMetadata = {
        id: 'older-snap-2',
        name: 'snapshot_old2.json.gz',
        appProperties: { type: 'snapshot' },
      };

      const dominatedPayload: SnapshotPayload = {
        version: 1,
        hlc: '2026-10-15T10:00:00.000Z_0000_device-1',
        deviceId: 'device-1',
        coveredJournalFileIds: ['j0', 'j1'],
        watermarks: { 'device-1': '2026-10-15T10:00:00.000Z_0000_device-1' },
        state: null,
      };

      const notDominatedPayload: SnapshotPayload = {
        version: 1,
        hlc: '2026-10-15T10:30:00.000Z_0000_device-2',
        deviceId: 'device-2',
        coveredJournalFileIds: ['peer-j99'], // Not covered by the new snapshot!
        watermarks: { 'device-2': '2026-10-15T10:30:00.000Z_0000_device-2' },
        state: null,
      };

      mockDriveClient.downloadCompressedJson?.mockImplementation(async (id: string) => {
        if (id === 'older-snap-1') return dominatedPayload;
        if (id === 'older-snap-2') return notDominatedPayload;
        throw new Error('Not found');
      });

      mockDriveClient.uploadCompressedJson?.mockResolvedValue({ id: 'new-snap-id' });

      const journals: DriveFileMetadata[] = [
        {
          id: 'j0',
          name: 'journal_0.json.gz',
          createdTime: new Date(fixedNow.getTime() - 60 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T11:00:00.000Z_0000_device-1' },
        },
        {
          id: 'j1',
          name: 'journal_1.json.gz',
          createdTime: new Date(fixedNow.getTime() - 50 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T11:10:00.000Z_0000_device-1' },
        },
        {
          id: 'j2',
          name: 'journal_2.json.gz',
          createdTime: new Date(fixedNow.getTime() - 40 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T11:20:00.000Z_0000_device-1' },
        },
        {
          id: 'j3',
          name: 'journal_3.json.gz',
          createdTime: new Date(fixedNow.getTime() - 30 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T11:30:00.000Z_0000_device-1' },
        },
      ];

      const allFiles = [...journals, olderSnapshotDominated, olderSnapshotNotDominated];
      const compactor = createCompactor();

      const result = await compactor.compact({
        files: allFiles,
        force: true,
        watermarks: {
          'device-1': '2026-10-15T11:20:00.000Z_0000_device-1',
        },
      });

      // New snapshot covers j0, j1 (j2 and j3 are the 2 most recent)
      expect(result.coveredJournalFileIds).toEqual(['j0', 'j1']);

      // older-snap-1 is dominated (covers j0, j1), so it must be deleted
      expect(result.deletedSnapshotFileIds).toContain('older-snap-1');
      expect(mockDriveClient.deleteFile).toHaveBeenCalledWith('older-snap-1', expect.any(String));

      // older-snap-2 is NOT dominated (covers peer-j99), so it must be preserved
      expect(result.deletedSnapshotFileIds).not.toContain('older-snap-2');
      expect(mockDriveClient.deleteFile).not.toHaveBeenCalledWith('older-snap-2', expect.any(String));
    });
  });

  describe('100% Storage Quota Escape Hatch', () => {
    it('deletes reserve slot cushion when snapshot throws DriveQuotaExceededError, retries upload, and re-provisions cushion', async () => {
      const reserveFile: DriveFileMetadata = {
        id: 'reserve-file-to-delete',
        name: RESERVE_SLOT_FILENAME,
        appProperties: { type: 'reserve' },
      };

      const journals: DriveFileMetadata[] = Array.from({ length: 45 }, (_, i) => ({
        id: `journal-${i}`,
        name: `journal_${i}.json.gz`,
        createdTime: new Date(fixedNow.getTime() - (60 - i) * 60 * 1000).toISOString(),
        appProperties: {
          type: 'journal',
          hlc: `2026-10-15T10:${String(i).padStart(2, '0')}:00.000Z_0000_device-1`,
        },
        size: '1000',
      }));

      const allFiles = [...journals, reserveFile];

      const callSequence: string[] = [];
      let uploadAttempts = 0;

      mockDriveClient.uploadCompressedJson?.mockImplementation(async (name) => {
        uploadAttempts++;
        callSequence.push(`uploadCompressedJson:attempt-${uploadAttempts}`);
        if (uploadAttempts === 1) {
          throw new DriveQuotaExceededError('Drive storage quota exceeded (100% full)');
        }
        return {
          id: 'snapshot-file-success',
          name,
          appProperties: { type: 'snapshot' },
        };
      });

      mockDriveClient.deleteFile.mockImplementation(async (id: string) => {
        callSequence.push(`deleteFile:${id}`);
      });

      mockDriveClient.uploadFile.mockImplementation(async (params) => {
        callSequence.push(`uploadFile:${params.name}`);
        return {
          id: 'recreated-reserve-slot',
          name: params.name,
          appProperties: params.appProperties,
        };
      });

      // When ensureReserveSlot checks listFiles after deletion, return empty so it recreates
      mockDriveClient.listFiles.mockImplementation(async () => {
        if (callSequence.includes('deleteFile:reserve-file-to-delete')) {
          return [];
        }
        return allFiles;
      });

      const compactor = createCompactor();
      const result = await compactor.compact({ files: allFiles });

      expect(result.compacted).toBe(true);
      expect(result.reserveSlotRecovered).toBe(true);
      expect(result.snapshotFile?.id).toBe('snapshot-file-success');

      // Verify strict escape hatch sequence:
      // 1. Attempt upload snapshot -> fails with quota exceeded
      // 2. Delete reserve_slot.bin (frees 1 MB)
      // 3. Retry upload snapshot -> succeeds
      // 4. Delete covered journals
      // 5. Re-allocate reserve_slot.bin
      const firstUploadIdx = callSequence.indexOf('uploadCompressedJson:attempt-1');
      const deleteReserveIdx = callSequence.indexOf('deleteFile:reserve-file-to-delete');
      const secondUploadIdx = callSequence.indexOf('uploadCompressedJson:attempt-2');
      const deleteFirstJournalIdx = callSequence.findIndex((s) => s.startsWith('deleteFile:journal-'));
      const recreateReserveIdx = callSequence.indexOf('uploadFile:reserve_slot.bin');

      expect(firstUploadIdx).toBe(0);
      expect(deleteReserveIdx).toBeGreaterThan(firstUploadIdx);
      expect(secondUploadIdx).toBeGreaterThan(deleteReserveIdx);
      expect(deleteFirstJournalIdx).toBeGreaterThan(secondUploadIdx);
      expect(recreateReserveIdx).toBeGreaterThan(deleteFirstJournalIdx);
    });
  });

  describe('dominatesCoverage helper', () => {
    it('returns true when newer snapshot supersets coveredJournalFileIds and watermarks', () => {
      const newer = {
        coveredJournalFileIds: ['j1', 'j2', 'j3'],
        watermarks: {
          'dev-1': '2026-10-15T12:00:00.000Z_0000_dev-1',
          'dev-2': '2026-10-15T11:00:00.000Z_0000_dev-2',
        },
      };
      const older = {
        coveredJournalFileIds: ['j1', 'j2'],
        watermarks: {
          'dev-1': '2026-10-15T11:00:00.000Z_0000_dev-1',
        },
      };

      expect(dominatesCoverage(newer, older)).toBe(true);
    });

    it('returns false when older snapshot has a journal not covered by newer snapshot', () => {
      const newer = {
        coveredJournalFileIds: ['j1', 'j2'],
      };
      const older = {
        coveredJournalFileIds: ['j1', 'j2', 'j3'],
      };

      expect(dominatesCoverage(newer, older)).toBe(false);
    });

    it('returns false when older watermark is ahead of newer watermark for any device', () => {
      const newer = {
        coveredJournalFileIds: ['j1'],
        watermarks: {
          'dev-1': '2026-10-15T10:00:00.000Z_0000_dev-1',
        },
      };
      const older = {
        coveredJournalFileIds: ['j1'],
        watermarks: {
          'dev-1': '2026-10-15T12:00:00.000Z_0000_dev-1',
        },
      };

      expect(dominatesCoverage(newer, older)).toBe(false);
    });
  });

  describe('404 Delete Resiliency (Peer Compaction Race)', () => {
    it('deleteFile treats 404 as successful deletion and returns true', async () => {
      mockDriveClient.deleteFile.mockRejectedValueOnce(
        new DriveHttpError('File not found: j-already-deleted', 404, 'Not Found')
      );

      const compactor = createCompactor();
      const result = await compactor.deleteFile('j-already-deleted', 'test-token');

      expect(result).toBe(true);
      expect(mockDriveClient.deleteFile).toHaveBeenCalledWith('j-already-deleted', 'test-token');
    });

    it('deleteFile rethrows non-404 errors', async () => {
      mockDriveClient.deleteFile.mockRejectedValueOnce(
        new DriveHttpError('Internal Server Error', 500, 'Server Error')
      );

      const compactor = createCompactor();
      await expect(compactor.deleteFile('j-server-err', 'test-token')).rejects.toThrow(
        DriveHttpError
      );
    });

    it('compact treats 404 on deleteCoveredJournals as successful deletion', async () => {
      const journals: DriveFileMetadata[] = [
        {
          id: 'j-404',
          name: 'journal_404.json.gz',
          createdTime: new Date(fixedNow.getTime() - 60 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T10:00:00.000Z_0000_device-1' },
        },
        {
          id: 'j-normal',
          name: 'journal_normal.json.gz',
          createdTime: new Date(fixedNow.getTime() - 50 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T10:10:00.000Z_0000_device-1' },
        },
        {
          id: 'j-recent-1',
          name: 'journal_r1.json.gz',
          createdTime: new Date(fixedNow.getTime() - 5 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T11:55:00.000Z_0000_device-1' },
        },
        {
          id: 'j-recent-2',
          name: 'journal_r2.json.gz',
          createdTime: new Date(fixedNow.getTime() - 1 * 60 * 1000).toISOString(),
          appProperties: { type: 'journal', hlc: '2026-10-15T11:59:00.000Z_0000_device-1' },
        },
      ];

      mockDriveClient.uploadCompressedJson?.mockResolvedValue({ id: 'new-snap-id' });
      mockDriveClient.deleteFile.mockImplementation(async (id: string) => {
        if (id === 'j-404') {
          throw new DriveHttpError('File not found', 404, 'Not Found');
        }
      });

      const compactor = createCompactor();
      const result = await compactor.compact({
        files: journals,
        force: true,
      });

      expect(result.compacted).toBe(true);
      expect(result.coveredJournalFileIds).toEqual(['j-404', 'j-normal']);
      // j-404 must be included in deletedJournalFileIds despite throwing 404
      expect(result.deletedJournalFileIds).toContain('j-404');
      expect(result.deletedJournalFileIds).toContain('j-normal');
    });
  });
});

