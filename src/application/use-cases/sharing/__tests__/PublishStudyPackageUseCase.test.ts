import { describe, expect, it, vi } from 'vitest';
import { PublishStudyPackageUseCase } from '../PublishStudyPackageUseCase';
import type { MaterializeStudyPackageUseCase } from '../../package/MaterializeStudyPackageUseCase';
import type { ShareTransport } from '../../../../domain/sharing/models/sharing.types';
import type { StudyPackage } from '../../../../domain/package/models/package.types';

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

    const transport = (): ShareTransport => ({
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
    });

    it('materializes package and publishes via transport', async () => {
        const mockMaterialize = {
            execute: vi.fn().mockResolvedValue(mockPackage),
        } as unknown as MaterializeStudyPackageUseCase;

        const mockTransport = transport();

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

    /**
     * The local publish gate. `MaterializeStudyPackageUseCase` copies each question's payload
     * VERBATIM, so a question that arrived malformed from a legacy share is re-materialized exactly
     * as malformed — the Worker would refuse the POST, but only after a round trip.
     *
     * This fails if the `validateStudyPackage(..., { strictness: 'publish' })` call is removed: the
     * transport would then be handed the malformed package and `publish` would be called.
     */
    it('refuses to publish a package the strict client tier rejects, before any request goes out', async () => {
        const malformedPackage: StudyPackage = {
            ...mockPackage,
            questions: [
                {
                    id: 'pkg_q_legacy_cloze',
                    materialId: 'pkg_mat_1',
                    type: 'fill_in_blank',
                    prompt: 'Fill in the blanks.',
                    payload: {
                        type: 'fill_in_blank',
                        // Two `___` markers, one answer — the shape a pre-validation share carries.
                        template: 'The ___ is the ___ of the cell.',
                        blanks: ['nucleus'],
                    },
                    difficulty: 'medium',
                    points: 1,
                },
            ],
        };

        const mockMaterialize = {
            execute: vi.fn().mockResolvedValue(malformedPackage),
        } as unknown as MaterializeStudyPackageUseCase;
        const mockTransport = transport();

        const useCase = new PublishStudyPackageUseCase(mockMaterialize, mockTransport);

        await expect(
            useCase.execute({ materialId: 'mat_legacy', accessType: 'public' }),
        ).rejects.toThrow(
            /Cannot publish this material: Question "pkg_q_legacy_cloze": fill_in_blank payload requires exactly one answer per/,
        );
        expect(mockTransport.publish).not.toHaveBeenCalled();
    });

    it('refuses to publish a package whose question payload names a different type than the question', async () => {
        const mismatchedPackage: StudyPackage = {
            ...mockPackage,
            questions: [
                {
                    id: 'pkg_q_mismatch',
                    materialId: 'pkg_mat_1',
                    type: 'identification',
                    prompt: 'Name the organelle.',
                    payload: { type: 'true_false', correctAnswer: true },
                    difficulty: 'medium',
                    points: 1,
                },
            ],
        };

        const mockMaterialize = {
            execute: vi.fn().mockResolvedValue(mismatchedPackage),
        } as unknown as MaterializeStudyPackageUseCase;
        const mockTransport = transport();

        const useCase = new PublishStudyPackageUseCase(mockMaterialize, mockTransport);

        await expect(
            useCase.execute({ materialId: 'mat_mismatch', accessType: 'public' }),
        ).rejects.toThrow(/Cannot publish this material/);
        expect(mockTransport.publish).not.toHaveBeenCalled();
    });

    it('publishes a package whose only defect is a blank cloze answer — the strict tier is per-type, not a blank-answer ban', async () => {
        // Guards the gate against being over-broad: parity holds here, so the only fault is an empty
        // answer, and the publish tier refuses it for exactly that reason rather than for a shape.
        const blankAnswerPackage: StudyPackage = {
            ...mockPackage,
            questions: [
                {
                    id: 'pkg_q_blank_answer',
                    materialId: 'pkg_mat_1',
                    type: 'fill_in_blank',
                    prompt: 'Fill in the blank.',
                    payload: { type: 'fill_in_blank', template: 'The ___ is central.', blanks: [''] },
                    difficulty: 'medium',
                    points: 1,
                },
            ],
        };

        const mockMaterialize = {
            execute: vi.fn().mockResolvedValue(blankAnswerPackage),
        } as unknown as MaterializeStudyPackageUseCase;
        const mockTransport = transport();

        const useCase = new PublishStudyPackageUseCase(mockMaterialize, mockTransport);

        await expect(
            useCase.execute({ materialId: 'mat_blank', accessType: 'public' }),
        ).rejects.toThrow(/non-empty answer for every/);
        expect(mockTransport.publish).not.toHaveBeenCalled();
    });
});
