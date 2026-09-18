import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMaterialAssets } from '../useMaterialAssets';
import { ApplicationContext } from '../../../../app/providers/ApplicationContext';
import type { StoredAsset } from '../../../../domain/assets/repositories/AssetRepository';

function storedAsset(assetId: string, materialId: string): StoredAsset {
    return {
        assetId,
        materialId,
        blob: new Blob([`bytes:${assetId}`], { type: 'image/png' }),
        mimeType: 'image/png',
        filename: `${assetId}.png`,
        importedAt: '2026-09-01T00:00:00.000Z',
    };
}

describe('useMaterialAssets', () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    let createObjectURL: ReturnType<typeof vi.fn>;
    let revokeObjectURL: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        let created = 0;
        createObjectURL = vi.fn(() => `blob:lunaclair/${++created}`);
        revokeObjectURL = vi.fn();
        URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
        URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    });

    afterEach(() => {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
    });

    function setup(assetsByMaterial: Record<string, StoredAsset[]>) {
        const assetReader = {
            get: vi.fn().mockResolvedValue(undefined),
            getByMaterialId: vi.fn(async (materialId: string) => assetsByMaterial[materialId] ?? []),
        };
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        const wrapper = ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                <ApplicationContext.Provider value={{ repositories: { asset: assetReader } } as any}>
                    {children}
                </ApplicationContext.Provider>
            </QueryClientProvider>
        );
        return { assetReader, wrapper };
    }

    it('creates one object URL per stored asset, keyed by asset id', async () => {
        const { wrapper } = setup({
            'mat-1': [storedAsset('asset-a', 'mat-1'), storedAsset('asset-b', 'mat-1')],
        });

        const { result } = renderHook(() => useMaterialAssets('mat-1'), { wrapper });

        await waitFor(() => expect(result.current?.size).toBe(2));
        expect([...result.current!.keys()].sort()).toEqual(['asset-a', 'asset-b']);
        expect(createObjectURL).toHaveBeenCalledTimes(2);
        expect(revokeObjectURL).not.toHaveBeenCalled();
    });

    it('revokes the previous material\u2019s URLs when the material changes', async () => {
        const { wrapper } = setup({
            'mat-1': [storedAsset('asset-a', 'mat-1')],
            'mat-2': [storedAsset('asset-b', 'mat-2'), storedAsset('asset-c', 'mat-2')],
        });

        const { result, rerender } = renderHook(
            ({ materialId }) => useMaterialAssets(materialId),
            { wrapper, initialProps: { materialId: 'mat-1' } },
        );

        await waitFor(() => expect(result.current?.size).toBe(1));
        const firstUrl = result.current!.get('asset-a')!;

        rerender({ materialId: 'mat-2' });

        await waitFor(() => expect(result.current?.size).toBe(2));
        expect(revokeObjectURL).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith(firstUrl);
    });

    it('keeps the current URLs alive across re-renders of the same material', async () => {
        const { wrapper } = setup({ 'mat-1': [storedAsset('asset-a', 'mat-1')] });

        const { result, rerender } = renderHook(
            ({ tick }: { tick: number }) => {
                const assetUrls = useMaterialAssets('mat-1');
                return { assetUrls, tick };
            },
            { wrapper, initialProps: { tick: 0 } },
        );

        await waitFor(() => expect(result.current.assetUrls?.size).toBe(1));
        const url = result.current.assetUrls!.get('asset-a')!;

        rerender({ tick: 1 });
        rerender({ tick: 2 });

        expect(result.current.assetUrls!.get('asset-a')).toBe(url);
        expect(createObjectURL).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).not.toHaveBeenCalled();
    });

    it('revokes every URL exactly once across a material switch and unmount', async () => {
        const { wrapper } = setup({
            'mat-1': [storedAsset('asset-a', 'mat-1'), storedAsset('asset-b', 'mat-1')],
            'mat-2': [],
        });

        const { result, rerender, unmount } = renderHook(
            ({ materialId }) => useMaterialAssets(materialId),
            { wrapper, initialProps: { materialId: 'mat-1' } },
        );

        await waitFor(() => expect(result.current?.size).toBe(2));
        const firstMaterialUrls = [...result.current!.values()];

        rerender({ materialId: 'mat-2' });

        await waitFor(() => expect(result.current?.size).toBe(0));
        expect(revokeObjectURL).toHaveBeenCalledTimes(2);
        expect(new Set(revokeObjectURL.mock.calls.map((call) => call[0]))).toEqual(
            new Set(firstMaterialUrls),
        );

        unmount();

        // The second material had no assets, so unmount must not revoke anything again.
        expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    });
});
