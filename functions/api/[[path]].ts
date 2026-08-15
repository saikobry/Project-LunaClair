/**
 * Cloudflare Pages Function: reverse-proxies all `/api/*` requests on the
 * Pages domain to the Cloudflare Worker API (`https://api.project-lunaclair.workers.dev`).
 */

const WORKER_ORIGIN = 'https://api.project-lunaclair.workers.dev';

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const targetUrl = `${WORKER_ORIGIN}${url.pathname}${url.search}`;

  const request = new Request(targetUrl, context.request);
  return fetch(request);
};
