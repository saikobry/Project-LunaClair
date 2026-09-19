import type { AiModelRoute } from '../core/aiModels';
import type { Env } from '../core/types';
import { UkisAiProvider, UKISAI_DEFAULT_BASE_URL } from './ukisai';
import type { AiProvider } from './types';
import { WorkersAiProvider } from './workersAi';

/**
 * Resolves the provider that serves a model.
 *
 * Returns `undefined` when the provider's configuration is missing — an unbound Workers AI binding,
 * say — so the route can refuse the request explicitly instead of falling through to another model.
 * A model is served by exactly one provider, and the catalog row names which.
 *
 * `UKISAI_BASE_URL` exists so local dev and tests can point at a stub; production uses the hosted
 * research endpoint.
 */
export function resolveAiProvider(route: AiModelRoute, env: Env): AiProvider | undefined {
  switch (route.provider) {
    case 'workers-ai':
      return env.AI ? new WorkersAiProvider(env.AI) : undefined;
    case 'ukisai':
      return new UkisAiProvider(env.UKISAI_BASE_URL || UKISAI_DEFAULT_BASE_URL);
    default:
      return undefined;
  }
}
