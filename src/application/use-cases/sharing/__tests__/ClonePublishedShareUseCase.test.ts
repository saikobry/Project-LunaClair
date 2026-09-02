import { describe, expect, it, vi } from 'vitest';
import { ClonePublishedShareUseCase } from '../ClonePublishedShareUseCase';
import type { PublishedShare } from '../../../../domain/sharing/models/sharing.types';
import type { StudyPackage } from '../../../../domain/package/models/package.types';

describe('ClonePublishedShareUseCase', () => {
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

        const useCase = new ClonePublishedShareUseCase(mockFetch, mockImport, mockTrack);

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
