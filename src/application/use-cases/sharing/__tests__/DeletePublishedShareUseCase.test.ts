import { describe, expect, it, vi } from 'vitest';
import { DeletePublishedShareUseCase } from '../DeletePublishedShareUseCase';
import type { ShareTransport } from '../../../../domain/sharing/sharing.types';

describe('DeletePublishedShareUseCase', () => {
    it('delegates deletion to ShareTransport with shareId and authToken', async () => {
        const mockTransport: ShareTransport = {
            delete: vi.fn().mockResolvedValue(undefined),
            publish: vi.fn(),
            fetch: vi.fn(),
            listPublicShares: vi.fn(),
            trackDownload: vi.fn(),
        };

        const useCase = new DeletePublishedShareUseCase(mockTransport);
        await useCase.execute({ shareId: 'share-101', authToken: 'secret-token' });

        expect(mockTransport.delete).toHaveBeenCalledWith('share-101', 'secret-token', undefined);
    });
});
