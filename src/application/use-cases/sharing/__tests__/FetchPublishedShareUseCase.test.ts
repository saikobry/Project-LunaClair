import { describe, expect, it, vi } from 'vitest';
import { FetchPublishedShareUseCase } from '../FetchPublishedShareUseCase';
import type { PublishedShare, ShareTransport } from '../../../../domain/sharing/sharing.types';
import type { StudyPackage } from '../../../../domain/package/package.types';

describe('FetchPublishedShareUseCase', () => {
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
