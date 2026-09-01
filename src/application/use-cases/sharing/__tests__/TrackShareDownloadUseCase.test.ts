import { describe, expect, it, vi } from 'vitest';
import { TrackShareDownloadUseCase } from '../TrackShareDownloadUseCase';
import type { ShareTransport } from '../../../../domain/sharing/sharing.types';

describe('TrackShareDownloadUseCase', () => {
    it('delegates trackDownload to ShareTransport with string shareId', async () => {
        const mockTransport: ShareTransport = {
            trackDownload: vi.fn().mockResolvedValue({ success: true, downloadCount: 5 }),
            publish: vi.fn(),
            fetch: vi.fn(),
            listPublicShares: vi.fn(),
            delete: vi.fn(),
        };

        const useCase = new TrackShareDownloadUseCase(mockTransport);
        const result = await useCase.execute('share-101');

        expect(mockTransport.trackDownload).toHaveBeenCalledWith('share-101', undefined);
        expect(result).toEqual({ success: true, downloadCount: 5 });
    });

    it('delegates trackDownload to ShareTransport with object input', async () => {
        const mockTransport: ShareTransport = {
            trackDownload: vi.fn().mockResolvedValue({ success: true, downloadCount: 6 }),
            publish: vi.fn(),
            fetch: vi.fn(),
            listPublicShares: vi.fn(),
            delete: vi.fn(),
        };

        const useCase = new TrackShareDownloadUseCase(mockTransport);
        const result = await useCase.execute({ shareId: 'share-102' });

        expect(mockTransport.trackDownload).toHaveBeenCalledWith('share-102', undefined);
        expect(result).toEqual({ success: true, downloadCount: 6 });
    });
});
