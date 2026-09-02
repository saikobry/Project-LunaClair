import { describe, expect, it, vi } from 'vitest';
import { TouchMaterialUseCase } from '../TouchMaterialUseCase';
import type { LibraryRepository, UpdateMaterialInput } from '../../../../domain/library/repositories/LibraryRepository';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

describe('TouchMaterialUseCase', () => {
    it('updates lastOpenedAt timestamp within current time window', async () => {
        const mockMaterial: StudyMaterial = {
            id: 'mat-1',
            title: 'Cell Biology Notes',
            documentId: 'doc-1',
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-01T00:00:00.000Z',
        };

        const mockLibrary: LibraryRepository = {
            updateMaterial: vi.fn().mockImplementation((id: string, input: UpdateMaterialInput) =>
                Promise.resolve({
                    ...mockMaterial,
                    id,
                    ...input,
                }),
            ),
            getMaterials: vi.fn(),
            getMaterialById: vi.fn(),
            createMaterial: vi.fn(),
            deleteMaterial: vi.fn(),
        };

        const useCase = new TouchMaterialUseCase(mockLibrary);
        const before = new Date().toISOString();

        const result = await useCase.execute('mat-1');

        const after = new Date().toISOString();

        expect(mockLibrary.updateMaterial).toHaveBeenCalledWith(
            'mat-1',
            expect.objectContaining({
                lastOpenedAt: expect.any(String),
            }),
        );

        expect(result.lastOpenedAt).toBeDefined();
        const touchedAt = result.lastOpenedAt!;
        expect(touchedAt >= before).toBe(true);
        expect(touchedAt <= after).toBe(true);
    });

    it('propagates repository errors when update fails', async () => {
        const mockLibrary: LibraryRepository = {
            updateMaterial: vi.fn().mockRejectedValue(new Error('Material not found: mat-invalid')),
            getMaterials: vi.fn(),
            getMaterialById: vi.fn(),
            createMaterial: vi.fn(),
            deleteMaterial: vi.fn(),
        };

        const useCase = new TouchMaterialUseCase(mockLibrary);
        await expect(useCase.execute('mat-invalid')).rejects.toThrow('Material not found: mat-invalid');
    });
});
