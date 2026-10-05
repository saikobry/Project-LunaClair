/**
 * Cloudflare Pages Function: reverse-proxies all `/api/*` requests on the
 * Pages domain to the Cloudflare Worker API.
 *
 * The upstream Worker is read from the `API_ORIGIN` environment variable so a
 * single repository can back two Pages projects built from identical output —
 * only the backend differs:
 *
 *   - `project-lunaclair`         — `API_ORIGIN` unset, defaults to production
 *   - `project-lunaclair-staging` — `API_ORIGIN` = staging Worker
 *
 * This is the ONLY seam between the two environments. The frontend build, the
 * Service Worker precache, and every other asset are byte-identical; if the
 * staging site ever reaches production data, this variable is where to look.
 *
 * Set `API_ORIGIN` as a Pages environment variable (Settings → Environment
 * variables) per project — plain text, not a secret.
 */

const DEFAULT_WORKER_ORIGIN = 'https://api.project-lunaclair.workers.dev';

/** Bindings and environment variables available to this Function. */
interface PagesEnv {
  /** Static asset binding Pages injects for Functions. */
  ASSETS: Fetcher;
  /**
   * Upstream Worker origin for the `/api/*` proxy, set per Pages project as a
   * plain-text environment variable (Settings → Environment variables), not a
   * secret. Absent on the production project, which falls back to the default.
   */
  API_ORIGIN?: string;
}

export const onRequest: PagesFunction<PagesEnv> = async (context) => {
  const url = new URL(context.request.url);

  // Trailing slashes are stripped so a pasted origin can never produce a
  // double-slash path that misses the Worker's route table.
  const configured = context.env.API_ORIGIN;
  const origin =
    typeof configured === 'string' && configured.trim() !== ''
      ? configured.trim().replace(/\/+$/, '')
      : DEFAULT_WORKER_ORIGIN;

  const targetUrl = `${origin}${url.pathname}${url.search}`;
  const request = new Request(targetUrl, context.request);
  return fetch(request);
};