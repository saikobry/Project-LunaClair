import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readerQueryKeys } from '../queries/readerQueryKeys';
import { useAssetRepository } from './useAssetRepository';

/**
 * Resolves a material's locally stored binary assets into object URLs, keyed by asset id.
 *
 * The returned map is what `MarkdownViewer` needs to turn `lc-asset://{assetId}` references into
 * displayable sources. The lifecycle invariant: **an object URL stays valid for every `<img>`
 * rendered from the current map, and is revoked only once that map is no longer in use** — so
 * switching material releases the previous material's URLs, and unmounting releases the last set.
 *
 * URLs are created in an effect rather than during render because React StrictMode double-invokes
 * render-phase work, which would create URLs that never receive a cleanup.
 */
export function useMaterialAssets(materialId: string): Map<string, string> | undefined {
    const assetRepository = useAssetRepository();

    const { data: assets } = useQuery({
        queryKey: readerQueryKeys.assets(materialId),
        queryFn: () => assetRepository.getByMaterialId(materialId),
    });

    const [assetUrls, setAssetUrls] = useState<Map<string, string> | undefined>(undefined);

    useEffect(() => {
        if (!assets) {
            setAssetUrls(undefined);
            return;
        }

        const urls = new Map<string, string>();
        for (const asset of assets) {
            urls.set(asset.assetId, URL.createObjectURL(asset.blob));
        }
        setAssetUrls(urls);

        return () => {
            for (const url of urls.values()) {
                URL.revokeObjectURL(url);
            }
        };
    }, [assets]);

    return assetUrls;
}
