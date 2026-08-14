import type { CatalogRepository, CatalogSnapshot } from '../../domain/library/CatalogRepository';

/**
 * Concrete implementation of `CatalogRepository` backed by the LunaClair API
 * (`GET /api/catalog`). Requests are proxied in dev (Vite proxy) and production
 * (Cloudflare Pages `_redirects`), and cached offline by the service worker via
 * Workbox `CacheFirst`.
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
}

/** Singleton instance shared across the application composition root. */
export const apiCatalogRepository = new ApiCatalogRepository();
