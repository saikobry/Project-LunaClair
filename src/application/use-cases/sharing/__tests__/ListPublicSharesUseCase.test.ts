import { describe, expect, it, vi } from 'vitest';
import { ListPublicSharesUseCase } from '../ListPublicSharesUseCase';
import type { ShareTransport } from '../../../../domain/sharing/models/sharing.types';

describe('ListPublicSharesUseCase', () => {
    it('calls shareTransport.listPublicShares with search/filter parameters', async () => {
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

        const useCase = new ListPublicSharesUseCase(mockTransport);
        const result = await useCase.execute({ q: 'Chemistry', sort: 'popular', limit: 10 });

        expect(mockTransport.listPublicShares).toHaveBeenCalledWith(
            { q: 'Chemistry', sort: 'popular', limit: 10 },
            undefined,
        );
        expect(result.items).toHaveLength(1);
        expect(result.items[0].title).toBe('Public Chemistry Deck');
    });
});
