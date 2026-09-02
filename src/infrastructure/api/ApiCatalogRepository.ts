import type {
    CatalogRepository,
    CatalogSnapshot,
    MaterialResolution,
} from '../../domain/library/repositories/CatalogRepository';

/**
 * Concrete implementation of `CatalogRepository` backed by the LunaClair API.
 * The snapshot (`GET /api/catalog`) is proxied in dev (Vite proxy) and
 * production (Cloudflare Pages Functions), and cached offline by the service
 * worker via Workbox `CacheFirst`. The per-material resolution
 * (`GET /api/catalog/materials/:id`) is deliberately NOT cached (Worker sends
 * `Cache-Control: no-store`) — import must resolve against current server state.
 *
 * The catalog is **server state** — it is never copied wholesale into Dexie.
 * The app surfaces it as "Available Materials" and imports individual materials
 * on user action.
 */
export class ApiCatalogRepository implements CatalogRepository {
    async getCatalog(signal?: AbortSignal): Promise<CatalogSnapshot> {
        const response = await fetch('/api/catalog', { signal });
        if (!response.ok) {
            throw new Error(`Failed to fetch catalog (${response.status})`);
        }
        return (await response.json()) as CatalogSnapshot;
    }

    async getMaterial(materialId: string, signal?: AbortSignal): Promise<MaterialResolution> {
        const response = await fetch(`/api/catalog/materials/${materialId}`, { signal });
        if (!response.ok) {
            throw new Error(`Failed to fetch material ${materialId} (${response.status})`);
        }
        return (await response.json()) as MaterialResolution;
    }
}

/** Singleton instance shared across the application composition root. */
export const apiCatalogRepository = new ApiCatalogRepository();
