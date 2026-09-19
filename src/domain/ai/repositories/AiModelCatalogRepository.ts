import type { AiModelCatalog } from '../services/aiModelCatalog';

/**
 * Read-only port for the app's best-known AI model catalog.
 *
 * The catalog is a remote fact set owned by the Worker (`GET /api/ai/models`) with a bundled local
 * fallback, which is why this is a port rather than a pure function: the implementation decides how
 * far it is willing to go to refresh — and must answer offline rather than fail, because the app
 * meters requests and prices turns without a network.
 *
 * The returned catalog is the *best known*, not necessarily the newest: implementations merge a
 * fetch, a cache, and the bundled mirror by version.
 */
export interface AiModelCatalogRepository {
  getCatalog(): Promise<AiModelCatalog>;
}
