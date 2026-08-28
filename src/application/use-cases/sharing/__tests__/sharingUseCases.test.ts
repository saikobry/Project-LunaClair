/**
 * Unit Tests for Sharing Use Cases
 */
import { describe, expect, it, vi } from 'vitest';
import { PublishStudyPackageUseCase } from '../PublishStudyPackageUseCase';
import { FetchPublishedShareUseCase } from '../FetchPublishedShareUseCase';
import type { MaterializeStudyPackageUseCase } from '../../package/MaterializeStudyPackageUseCase';
import type { PublishedShare, ShareTransport } from '../../../../domain/sharing/sharing.types';
import type { StudyPackage } from '../../../../domain/package/package.types';

const mockPackage: StudyPackage = {
  format: 'lcpack',
  schemaVersion: 1,
  metadata: {
    title: 'Cell Biology',
    createdAt: '2026-08-28T00:00:00.000Z',
  },
  materials: [
    {
      id: 'pkg_mat_1',
      title: 'Cell Notes',
      documentContent: '# Cells',
    },
  ],
  questions: [],
  quizzes: [],
};

describe('PublishStudyPackageUseCase', () => {
  it('materializes package and publishes via transport', async () => {
    const mockMaterialize = {
      execute: vi.fn().mockResolvedValue(mockPackage),
    } as unknown as MaterializeStudyPackageUseCase;

    const mockTransport: ShareTransport = {
      publish: vi.fn().mockResolvedValue({
        id: 'share_abc',
        format: 'lcpack',
        schemaVersion: 1,
        title: 'Cell Biology',
        accessType: 'public',
        shareUrl: '/share/share_abc',
        createdAt: '2026-08-28T00:00:00.000Z',
      }),
      fetch: vi.fn(),
      listPublicShares: vi.fn(),
      trackDownload: vi.fn(),
      delete: vi.fn(),
    };

    const useCase = new PublishStudyPackageUseCase(mockMaterialize, mockTransport);
    const result = await useCase.execute({
      materialId: 'mat_123',
      accessType: 'public',
    });

    expect(mockMaterialize.execute).toHaveBeenCalledWith({ materialId: 'mat_123' });
    expect(mockTransport.publish).toHaveBeenCalledWith(
      mockPackage,
      expect.objectContaining({ accessType: 'public' }),
      undefined,
    );
    expect(result.id).toBe('share_abc');
  });
});

describe('FetchPublishedShareUseCase', () => {
  it('fetches and validates valid remote package', async () => {
    const mockShare: PublishedShare = {
      id: 'share_abc',
      format: 'lcpack',
      schemaVersion: 1,
      title: 'Cell Biology',
      accessType: 'public',
      package: mockPackage,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      viewCount: 1,
      downloadCount: 0,
    };

    const mockTransport: ShareTransport = {
      publish: vi.fn(),
      fetch: vi.fn().mockResolvedValue(mockShare),
      listPublicShares: vi.fn(),
      trackDownload: vi.fn(),
      delete: vi.fn(),
    };

    const useCase = new FetchPublishedShareUseCase(mockTransport);
    const result = await useCase.execute({ shareId: 'share_abc' });

    expect(mockTransport.fetch).toHaveBeenCalledWith('share_abc', undefined, undefined);
    expect(result.id).toBe('share_abc');
  });

  it('rejects corrupt remote package payload on client side', async () => {
    const corruptShare: PublishedShare = {
      id: 'share_corrupt',
      format: 'lcpack',
      schemaVersion: 1,
      title: 'Broken',
      accessType: 'public',
      package: {
        format: 'invalid',
        schemaVersion: 99,
        metadata: {},
        materials: [],
      } as any,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      viewCount: 0,
      downloadCount: 0,
    };

    const mockTransport: ShareTransport = {
      publish: vi.fn(),
      fetch: vi.fn().mockResolvedValue(corruptShare),
      listPublicShares: vi.fn(),
      trackDownload: vi.fn(),
      delete: vi.fn(),
    };

    const useCase = new FetchPublishedShareUseCase(mockTransport);
    await expect(useCase.execute({ shareId: 'share_corrupt' })).rejects.toThrow(
      'Remote study package failed domain validation',
    );
  });
});

describe('ListPublicSharesUseCase', () => {
  it('calls shareTransport.listPublicShares with params', async () => {
    const mockTransport: ShareTransport = {
      publish: vi.fn(),
      fetch: vi.fn(),
      trackDownload: vi.fn(),
      delete: vi.fn(),
      listPublicShares: vi.fn().mockResolvedValue({
        items: [
          {
            id: 'share_1',
            format: 'lcpack',
            schemaVersion: 1,
            title: 'Public Chemistry Deck',
            author: 'chemist_pro',
            viewCount: 15,
            downloadCount: 8,
            createdAt: '2026-08-28T00:00:00.000Z',
          },
        ],
        nextCursor: null,
        hasMore: false,
      }),
    };

    const useCase = new (await import('../ListPublicSharesUseCase')).ListPublicSharesUseCase(mockTransport);
    const result = await useCase.execute({ q: 'Chemistry', sort: 'popular', limit: 10 });

    expect(mockTransport.listPublicShares).toHaveBeenCalledWith(
      { q: 'Chemistry', sort: 'popular', limit: 10 },
      undefined,
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('Public Chemistry Deck');
  });
});

describe('ClonePublishedShareUseCase', () => {
  it('fetches, validates, imports into Dexie, and tracks download telemetry', async () => {
    const mockShare: PublishedShare = {
      id: 'share_test',
      format: 'lcpack',
      schemaVersion: 1,
      title: 'Cell Biology',
      accessType: 'public',
      package: mockPackage,
      createdAt: '2026-08-28T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
      viewCount: 1,
      downloadCount: 0,
    };

    const mockFetch = {
      execute: vi.fn().mockResolvedValue(mockShare),
    } as any;

    const mockImport = {
      execute: vi.fn().mockResolvedValue({
        materialIds: ['mat_new_1'],
        questionIds: [],
        quizIds: [],
        assetIds: [],
        idMap: new Map(),
      }),
    } as any;

    const mockTrack = {
      execute: vi.fn().mockResolvedValue({ success: true, downloadCount: 1 }),
    } as any;

    const useCase = new (await import('../ClonePublishedShareUseCase')).ClonePublishedShareUseCase(
      mockFetch,
      mockImport,
      mockTrack,
    );

    const result = await useCase.execute({ shareId: 'share_test', targetSubjectId: 'sub_1' });

    expect(mockFetch.execute).toHaveBeenCalledWith({ shareId: 'share_test', passcode: undefined }, undefined);
    expect(mockImport.execute).toHaveBeenCalledWith({
      package: mockPackage,
      targetSubjectId: 'sub_1',
      targetTermId: undefined,
    });
    expect(mockTrack.execute).toHaveBeenCalledWith({ shareId: 'share_test' }, undefined);
    expect(result.share.id).toBe('share_test');
    expect(result.importResult.materialIds[0]).toBe('mat_new_1');
  });
});
