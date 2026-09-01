import { describe, expect, it, vi } from 'vitest';
import { PublishStudyPackageUseCase } from '../PublishStudyPackageUseCase';
import type { MaterializeStudyPackageUseCase } from '../../package/MaterializeStudyPackageUseCase';
import type { ShareTransport } from '../../../../domain/sharing/sharing.types';
import type { StudyPackage } from '../../../../domain/package/package.types';

describe('PublishStudyPackageUseCase', () => {
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
